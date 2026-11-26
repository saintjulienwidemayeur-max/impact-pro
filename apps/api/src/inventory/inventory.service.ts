import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientStockException, InventoryItemNotFoundException } from './inventory.errors';

export interface StockLevels {
  onHand: number;
  reserved: number;
  damaged: number;
  inTransit: number;
  available: number;
}

/** available = onHand − reserved − damaged (in-transit stock is not yet sellable). */
export function computeAvailable(i: { onHand: number; reserved: number; damaged: number }): number {
  return i.onHand - i.reserved - i.damaged;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getLevels(variantId: string, locationId: string): Promise<StockLevels> {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
    });
    if (!item) throw new InventoryItemNotFoundException(variantId, locationId);
    const { onHand, reserved, damaged, inTransit } = item;
    return { onHand, reserved, damaged, inTransit, available: computeAvailable(item) };
  }

  /**
   * Concurrency-safe reservation.
   * A single conditional UPDATE increments `reserved` only if enough stock is available; PostgreSQL's
   * row lock serialises competing updates and re-evaluates the WHERE clause, so concurrent callers can
   * never oversell. The reservation row and ledger entry are written in the same transaction.
   */
  async reserve(variantId: string, locationId: string, quantity: number, reference: string, actorId?: string) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException({ code: 'INVALID_QUANTITY', message: 'Quantity must be a positive integer' });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE "InventoryItem"
           SET "reserved" = "reserved" + ${quantity},
               "version"  = "version" + 1,
               "updatedAt" = NOW()
         WHERE "variantId" = ${variantId}
           AND "locationId" = ${locationId}
           AND "onHand" - "reserved" - "damaged" >= ${quantity}
        RETURNING "id"`);

      const row = updated[0];
      if (!row) {
        const exists = await tx.inventoryItem.findUnique({
          where: { variantId_locationId: { variantId, locationId } },
          select: { id: true },
        });
        if (!exists) throw new InventoryItemNotFoundException(variantId, locationId);
        throw new InsufficientStockException(variantId, locationId, quantity);
      }

      const reservation = await tx.inventoryReservation.create({
        data: { inventoryItemId: row.id, quantity, reference },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: row.id,
          type: InventoryMovementType.RESERVE,
          quantity,
          bucket: 'reserved',
          reference: reservation.id,
          reason: reference,
          actorId,
        },
      });
      return reservation;
    });
  }

  /** Releases an ACTIVE reservation, returning its quantity to available stock. */
  async release(reservationId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryReservation.updateMany({
        where: { id: reservationId, status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.RELEASED },
      });
      if (claimed.count === 0) {
        const exists = await tx.inventoryReservation.findUnique({ where: { id: reservationId } });
        if (!exists) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found' });
        throw new ConflictException({ code: 'RESERVATION_NOT_ACTIVE', message: `Reservation is ${exists.status}` });
      }
      const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } });
      await tx.inventoryItem.update({
        where: { id: reservation.inventoryItemId },
        data: { reserved: { decrement: reservation.quantity }, version: { increment: 1 } },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: reservation.inventoryItemId,
          type: InventoryMovementType.RELEASE,
          quantity: -reservation.quantity,
          bucket: 'reserved',
          reference: reservation.id,
          actorId,
        },
      });
      return reservation;
    });
  }
}
