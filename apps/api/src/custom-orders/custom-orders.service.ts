import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CustomOrderStatus, Prisma, type PrintPlacement } from '@prisma/client';
import { CatalogService, unitPriceFor } from '../catalog/catalog.service';
import { money } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { logoUrl } from '../uploads/uploads.service';
import type { CreateCustomOrderDto } from './dto/create-custom-order.dto';

/** Logos must have been uploaded recently; older uploads are treated as unknown. */
export const UPLOAD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CustomOrderItemView {
  productSlug: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  placement: PrintPlacement;
  color: string | null;
  size: string | null;
  logoUrl: string;
}

export interface CustomOrderView {
  reference: string;
  status: CustomOrderStatus;
  currency: string;
  subtotal: string;
  items: CustomOrderItemView[];
  createdAt: string;
}

const orderInclude = { items: { orderBy: { lineNo: 'asc' as const } } } satisfies Prisma.CustomOrderInclude;
type OrderWithItems = Prisma.CustomOrderGetPayload<{ include: typeof orderInclude }>;

export function formatReference(seq: bigint | number, year: number): string {
  return `IP-${year}-${String(seq).padStart(6, '0')}`;
}

@Injectable()
export class CustomOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async create(dto: CreateCustomOrderDto, ctx: { ipAddress?: string; requestId?: string }): Promise<CustomOrderView> {
    const order = await this.prisma.$transaction(async (tx) => {
      const uploadCutoff = new Date(Date.now() - UPLOAD_MAX_AGE_MS);
      const lines: Prisma.CustomOrderItemCreateWithoutOrderInput[] = [];
      let subtotal = new Prisma.Decimal(0);

      for (const [index, item] of dto.items.entries()) {
        const product = await this.catalog.findActiveForPricing(item.productSlug, tx);
        if (item.quantity < product.minOrderQty) {
          throw new UnprocessableEntityException({
            code: 'QUANTITY_BELOW_MINIMUM',
            message: `Minimum quantity for "${product.name}" is ${product.minOrderQty}`,
            details: { index, productSlug: product.slug, minQty: product.minOrderQty, quantity: item.quantity },
          });
        }
        const upload = await tx.upload.findFirst({
          where: { id: item.logoUploadId, createdAt: { gte: uploadCutoff } },
          select: { id: true },
        });
        if (!upload) {
          throw new UnprocessableEntityException({
            code: 'UPLOAD_NOT_FOUND',
            message: 'The logo file was not found or has expired; please upload it again',
            details: { index, logoUploadId: item.logoUploadId },
          });
        }

        const variant = product.variants[0];
        const unitPrice = unitPriceFor(variant.basePrice, variant.priceTiers, item.quantity);
        const lineTotal = unitPrice.mul(item.quantity);
        subtotal = subtotal.add(lineTotal);
        lines.push({
          product: { connect: { id: product.id } },
          variantId: variant.id,
          productSlug: product.slug,
          productName: product.name,
          unitPrice,
          quantity: item.quantity,
          lineTotal,
          color: item.color ?? null,
          size: item.size ?? null,
          placement: item.placement,
          upload: { connect: { id: upload.id } },
          notes: item.notes ?? null,
          lineNo: index + 1,
        });
      }

      const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('custom_order_ref_seq')`;
      const reference = formatReference(nextval, new Date().getUTCFullYear());

      const created = await tx.customOrder.create({
        data: {
          reference,
          currency: 'HTG',
          subtotal,
          customerName: dto.customer.fullName,
          company: dto.customer.company ?? null,
          phone: dto.customer.phone,
          email: dto.customer.email.toLowerCase(),
          city: dto.customer.city ?? null,
          address: dto.customer.address ?? null,
          deliveryMethod: dto.deliveryMethod,
          notes: dto.notes ?? null,
          ipAddress: ctx.ipAddress ?? null,
          items: { create: lines },
        },
        include: orderInclude,
      });

      await tx.auditLog.create({
        data: {
          action: 'custom_order.create',
          entityType: 'CustomOrder',
          entityId: created.id,
          metadata: { reference, itemCount: lines.length, subtotal: money(subtotal), currency: 'HTG' },
          ipAddress: ctx.ipAddress ?? null,
          requestId: ctx.requestId ?? null,
        },
      });
      return created;
    });
    return this.toView(order);
  }

  /** Returns the order only when the email matches; any mismatch is indistinguishable from "not found". */
  async track(reference: string, email: string): Promise<CustomOrderView> {
    const order = await this.prisma.customOrder.findUnique({ where: { reference }, include: orderInclude });
    if (!order || order.email !== email.trim().toLowerCase()) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }
    return this.toView(order);
  }

  private toView(o: OrderWithItems): CustomOrderView {
    return {
      reference: o.reference,
      status: o.status,
      currency: o.currency,
      subtotal: money(o.subtotal),
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        productSlug: i.productSlug,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: money(i.unitPrice),
        lineTotal: money(i.lineTotal),
        placement: i.placement,
        color: i.color,
        size: i.size,
        logoUrl: logoUrl(i.uploadId),
      })),
    };
  }
}
