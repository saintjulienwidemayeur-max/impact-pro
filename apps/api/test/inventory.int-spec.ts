import { PrismaClient } from '@prisma/client';
import { InsufficientStockException } from '../src/inventory/inventory.errors';
import { InventoryService } from '../src/inventory/inventory.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration test against a real PostgreSQL database (impact_pro_test).
 * Verifies concurrent reservations never oversell and the ledger is immutable.
 */
describe('InventoryService (integration)', () => {
  const prisma = new PrismaClient();
  const service = new InventoryService(prisma as unknown as PrismaService);
  const suffix = Date.now().toString(36);
  let variantId: string;
  let locationId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.create({ data: { name: 'Test', slug: `test-${suffix}` } });
    const product = await prisma.product.create({
      data: { name: 'Tasse test', slug: `tasse-${suffix}`, categoryId: category.id },
    });
    const variant = await prisma.productVariant.create({
      data: { productId: product.id, sku: `TST-${suffix}`, name: 'Blanc 11oz', basePrice: '350.00' },
    });
    const warehouse = await prisma.warehouse.create({ data: { code: `WH-${suffix}`, name: 'Test WH' } });
    const location = await prisma.warehouseLocation.create({ data: { warehouseId: warehouse.id, code: 'A-01' } });
    await prisma.inventoryItem.create({
      data: { variantId: variant.id, locationId: location.id, onHand: 10, damaged: 1 },
    });
    variantId = variant.id;
    locationId = location.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows exactly the available quantity across 20 concurrent reservations (no oversell)', async () => {
    // onHand 10, damaged 1 → available 9. 20 concurrent requests of 1 unit each.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => service.reserve(variantId, locationId, 1, `order-${i}`)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(ok).toHaveLength(9);
    expect(failed).toHaveLength(11);
    failed.forEach((f) => expect(f.reason).toBeInstanceOf(InsufficientStockException));

    const levels = await service.getLevels(variantId, locationId);
    expect(levels).toMatchObject({ onHand: 10, reserved: 9, damaged: 1, available: 0 });

    const item = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_locationId: { variantId, locationId } },
    });
    const movements = await prisma.inventoryMovement.count({ where: { inventoryItemId: item.id, type: 'RESERVE' } });
    const reservations = await prisma.inventoryReservation.count({ where: { inventoryItemId: item.id, status: 'ACTIVE' } });
    expect(movements).toBe(9);
    expect(reservations).toBe(9);
  });

  it('release returns stock and cannot be applied twice', async () => {
    const reservation = await prisma.inventoryReservation.findFirstOrThrow({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: reservation.inventoryItemId } });
    await service.release(reservation.id);
    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.reserved).toBe(item.reserved - reservation.quantity);
    await expect(service.release(reservation.id)).rejects.toThrow(/RELEASED/);
  });

  it('rejects mixed-size concurrent reservations beyond availability', async () => {
    const levels = await service.getLevels(variantId, locationId);
    const results = await Promise.allSettled(
      [2, 2, 2, 2].map((q, i) => service.reserve(variantId, locationId, q, `bulk-${i}`)),
    );
    const reservedQty = results.filter((r) => r.status === 'fulfilled').length * 2;
    expect(reservedQty).toBeLessThanOrEqual(levels.available);
    const final = await service.getLevels(variantId, locationId);
    expect(final.available).toBeGreaterThanOrEqual(0);
  });

  it('rejects invalid quantities', async () => {
    await expect(service.reserve(variantId, locationId, 0, 'x')).rejects.toThrow('positive integer');
  });

  it('database CHECK constraint blocks negative availability even on direct writes', async () => {
    await expect(
      prisma.inventoryItem.update({
        where: { variantId_locationId: { variantId, locationId } },
        data: { reserved: 999 },
      }),
    ).rejects.toThrow();
  });

  it('inventory ledger rows are immutable', async () => {
    const movement = await prisma.inventoryMovement.findFirstOrThrow();
    await expect(prisma.inventoryMovement.update({ where: { id: movement.id }, data: { reason: 'tamper' } })).rejects.toThrow(
      /immutable/,
    );
    await expect(prisma.inventoryMovement.delete({ where: { id: movement.id } })).rejects.toThrow(/immutable/);
  });
});
