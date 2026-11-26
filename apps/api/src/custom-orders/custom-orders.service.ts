import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CustomOrderStatus, ElementKind, PricingMode, Prisma, UploadPurpose, type PrintPlacement } from '@prisma/client';
import { CatalogService, unitPriceFor, type ProductWithPricing } from '../catalog/catalog.service';
import { MAX_ELEMENTS_PER_ZONE, parseCustomSize } from '../catalog/placements';
import { money } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { previewUrl, uploadUrl } from '../uploads/uploads.service';
import type { CreateCustomOrderDto, CustomOrderItemDto, DesignElementDto, ItemPreviewDto } from './dto/create-custom-order.dto';

/** Uploads must have been made recently; older uploads are treated as unknown. */
export const UPLOAD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface DesignElementView {
  placement: PrintPlacement;
  kind: ElementKind;
  text?: string;
  font?: string;
  fontWeight?: string;
  color?: string;
  align?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  sort: number;
  /** Relative URL of the upload (LOGO / ARTWORK elements). */
  logoUrl?: string;
  originalName?: string;
}

export interface CustomOrderItemView {
  productSlug: string;
  productName: string;
  quantity: number;
  /** PER_PIECE: price of one piece. PER_AREA: price of one piece of the ordered size. */
  unitPrice: string;
  lineTotal: string;
  /** First element's placement / logo (kept for older consumers); null when the item has no element. */
  placement: PrintPlacement | null;
  color: string | null;
  size: string | null;
  logoUrl: string | null;
  widthCm?: number;
  heightCm?: number;
  /** Billable area in m² (PER_AREA products). */
  areaM2?: number;
  elements: DesignElementView[];
  /** Rendered mock-ups per zone, when the storefront uploaded them. */
  previews: { placement: PrintPlacement; url: string }[];
}

export interface CustomOrderView {
  reference: string;
  status: CustomOrderStatus;
  currency: string;
  subtotal: string;
  items: CustomOrderItemView[];
  createdAt: string;
}

const orderInclude = {
  items: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      elements: {
        orderBy: { sort: 'asc' as const },
        include: { upload: { select: { id: true, purpose: true, originalName: true } } },
      },
      previews: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }], select: { placement: true, uploadId: true } },
    },
  },
} satisfies Prisma.CustomOrderInclude;
type OrderWithItems = Prisma.CustomOrderGetPayload<{ include: typeof orderInclude }>;

export function formatReference(seq: bigint | number, year: number): string {
  return `IP-${year}-${String(seq).padStart(6, '0')}`;
}

/** A design element with every default applied. */
interface NormalizedElement {
  /** Client-provided layer order (or the array index); only used to order elements, then replaced by the final position. */
  sortKey: number;
  placement: PrintPlacement;
  kind: ElementKind;
  uploadId: string | null;
  text: string | null;
  font: string | null;
  fontWeight: string | null;
  color: string | null;
  align: string | null;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

function normalizeElement(e: DesignElementDto, index: number): NormalizedElement {
  const isText = e.kind === ElementKind.TEXT;
  return {
    sortKey: e.sort ?? index,
    placement: e.placement,
    kind: e.kind,
    uploadId: isText ? null : (e.uploadId ?? null),
    text: isText ? (e.text ?? null) : null,
    font: isText ? (e.font ?? 'inter') : null,
    fontWeight: isText ? (e.fontWeight ?? 'regular') : null,
    color: isText ? (e.color?.toUpperCase() ?? '#000000') : null,
    align: isText ? (e.align ?? 'center') : null,
    x: e.x ?? 0,
    y: e.y ?? 0,
    scale: e.scale ?? 1,
    rotation: e.rotation ?? 0,
  };
}

function unprocessable(code: string, message: string, details?: unknown): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message, details });
}

/** Accent-, case- and space-insensitive key used to match a submitted option against the product's list. */
const optionKey = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

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
      let elementCount = 0;

      for (const [index, item] of dto.items.entries()) {
        const product = await this.catalog.findActiveForPricing(item.productSlug, tx);
        if (item.quantity < product.minOrderQty) {
          throw unprocessable('QUANTITY_BELOW_MINIMUM', `Minimum quantity for "${product.name}" is ${product.minOrderQty}`, {
            index,
            productSlug: product.slug,
            minQty: product.minOrderQty,
            quantity: item.quantity,
          });
        }

        const options = this.resolveOptions(item, product, index);
        const elements = this.resolveElements(item, product, index);
        this.checkElements(elements, product, index);
        await this.checkUploads(tx, elements, uploadCutoff, index);
        const previews = this.resolvePreviews(item.previews, product, index);
        await this.checkPreviewUploads(tx, previews, uploadCutoff, index);

        const { unitPrice, lineTotal, widthCm, heightCm, areaM2 } = this.price(product, item, index);
        subtotal = subtotal.add(lineTotal);
        elementCount += elements.length;

        const variant = product.variants[0];
        const firstWithUpload = elements.find((e) => e.uploadId);
        lines.push({
          product: { connect: { id: product.id } },
          variantId: variant.id,
          productSlug: product.slug,
          productName: product.name,
          unitPrice,
          quantity: item.quantity,
          lineTotal,
          color: options.color,
          size: options.size,
          widthCm,
          heightCm,
          areaM2,
          placement: elements[0].placement,
          upload: firstWithUpload?.uploadId ? { connect: { id: firstWithUpload.uploadId } } : undefined,
          notes: item.notes ?? null,
          lineNo: index + 1,
          previews: previews.length
            ? { create: previews.map((p) => ({ placement: p.placement, upload: { connect: { id: p.uploadId } } })) }
            : undefined,
          elements: {
            create: elements.map((e, sort) => ({
              sort,
              placement: e.placement,
              kind: e.kind,
              upload: e.uploadId ? { connect: { id: e.uploadId } } : undefined,
              text: e.text,
              font: e.font,
              fontWeight: e.fontWeight,
              color: e.color,
              align: e.align,
              x: e.x,
              y: e.y,
              scale: e.scale,
              rotation: e.rotation,
            })),
          },
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
          metadata: { reference, itemCount: lines.length, elementCount, subtotal: money(subtotal), currency: 'HTG' },
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

  /**
   * Color / size options: a selector only exists when the product lists values. A submitted value must be one of them
   * (matched ignoring case and accents, stored as the product's own spelling); required selectors must be filled.
   * Products with a custom size (banners…) list `sizes` only as quick presets, so the size stays optional there.
   */
  private resolveOptions(item: CustomOrderItemDto, product: ProductWithPricing, index: number): { color: string | null; size: string | null } {
    const pick = (field: 'color' | 'size', value: string | undefined, allowed: string[], required: boolean, label: string) => {
      if (value === undefined) {
        if (required && allowed.length > 0) {
          throw unprocessable(field === 'color' ? 'COLOR_REQUIRED' : 'SIZE_REQUIRED', `Please choose: ${label}`, {
            index,
            productSlug: product.slug,
            field,
            label,
            allowed,
          });
        }
        return null;
      }
      const match = allowed.find((a) => optionKey(a) === optionKey(value));
      if (!match) {
        throw unprocessable('INVALID_OPTION', `"${value}" is not available for ${label.toLowerCase()} on this product`, {
          index,
          productSlug: product.slug,
          field,
          label,
          value,
          allowed,
        });
      }
      return match;
    };
    return {
      color: pick('color', item.color, product.colors, product.colorsRequired, product.colorLabel),
      size: pick('size', item.size, product.sizes, product.sizesRequired && !parseCustomSize(product.customSize), product.sizeLabel),
    };
  }

  /** Mock-up previews per zone: zones must exist on the product, at most one preview per zone. */
  private resolvePreviews(previews: ItemPreviewDto[] | undefined, product: ProductWithPricing, index: number): ItemPreviewDto[] {
    if (!previews?.length) return [];
    const seen = new Set<PrintPlacement>();
    for (const [i, p] of previews.entries()) {
      if (!product.placements.includes(p.placement)) {
        throw unprocessable('VALIDATION_ERROR', 'Validation failed', [
          { field: `items.${index}.previews.${i}.placement`, messages: [`zone ${p.placement} is not available for this product`] },
        ]);
      }
      if (seen.has(p.placement)) {
        throw unprocessable('VALIDATION_ERROR', 'Validation failed', [
          { field: `items.${index}.previews.${i}.placement`, messages: [`only one preview per zone (${p.placement})`] },
        ]);
      }
      seen.add(p.placement);
    }
    return previews;
  }

  private async checkPreviewUploads(tx: Prisma.TransactionClient, previews: ItemPreviewDto[], cutoff: Date, index: number): Promise<void> {
    if (previews.length === 0) return;
    const ids = [...new Set(previews.map((p) => p.uploadId))];
    const found = await tx.upload.findMany({
      where: { id: { in: ids }, purpose: UploadPurpose.PREVIEW, createdAt: { gte: cutoff } },
      select: { id: true },
    });
    const ok = new Set(found.map((u) => u.id));
    for (const [previewIndex, p] of previews.entries()) {
      if (!ok.has(p.uploadId)) {
        throw unprocessable('UPLOAD_NOT_FOUND', 'The preview was not found or has expired; please upload it again', {
          index,
          previewIndex,
          uploadId: p.uploadId,
        });
      }
    }
  }

  /** `elements` as sent, or the legacy `placement` + `logoUploadId` shorthand as one centered LOGO element. */
  private resolveElements(item: CustomOrderItemDto, product: ProductWithPricing, index: number): NormalizedElement[] {
    if (item.elements?.length) {
      // Stable order by the layer index the client gave (array order when absent); final `sort` = position.
      return item.elements
        .map((e, i) => normalizeElement(e, i))
        .sort((a, b) => a.sortKey - b.sortKey);
    }
    if (item.placement && item.logoUploadId) {
      return [
        normalizeElement({ placement: item.placement, kind: ElementKind.LOGO, uploadId: item.logoUploadId } as DesignElementDto, 0),
      ];
    }
    if (product.artworkRequired) {
      throw unprocessable('ARTWORK_REQUIRED', `"${product.name}" needs your ready-to-print file`, { index, productSlug: product.slug });
    }
    throw unprocessable('VALIDATION_ERROR', 'Validation failed', [
      { field: `items.${index}.elements`, messages: ['at least one design element is required'] },
    ]);
  }

  private checkElements(elements: NormalizedElement[], product: ProductWithPricing, index: number): void {
    const perZone = new Map<PrintPlacement, number>();
    for (const [elementIndex, e] of elements.entries()) {
      const reason = !product.placements.includes(e.placement)
        ? `zone ${e.placement} is not available for this product`
        : e.kind === ElementKind.LOGO && !product.supportsLogo
          ? 'logos are not supported for this product'
          : e.kind === ElementKind.TEXT && !product.supportsText
            ? 'text is not supported for this product'
            : e.kind === ElementKind.ARTWORK && !product.supportsArtwork
              ? 'ready-to-print files are not supported for this product'
              : null;
      if (reason) {
        throw unprocessable('ELEMENT_NOT_SUPPORTED', reason, {
          index,
          elementIndex,
          productSlug: product.slug,
          placement: e.placement,
          kind: e.kind,
        });
      }
      const n = (perZone.get(e.placement) ?? 0) + 1;
      perZone.set(e.placement, n);
      if (n > MAX_ELEMENTS_PER_ZONE) {
        throw unprocessable('VALIDATION_ERROR', 'Validation failed', [
          { field: `items.${index}.elements`, messages: [`at most ${MAX_ELEMENTS_PER_ZONE} elements per zone (${e.placement})`] },
        ]);
      }
    }
    if (product.artworkRequired && !elements.some((e) => e.kind === ElementKind.ARTWORK)) {
      throw unprocessable('ARTWORK_REQUIRED', `"${product.name}" needs your ready-to-print file`, { index, productSlug: product.slug });
    }
  }

  private async checkUploads(tx: Prisma.TransactionClient, elements: NormalizedElement[], cutoff: Date, index: number): Promise<void> {
    const ids = [...new Set(elements.flatMap((e) => (e.uploadId ? [e.uploadId] : [])))];
    if (ids.length === 0) return;
    const found = await tx.upload.findMany({
      where: { id: { in: ids }, purpose: { in: [UploadPurpose.LOGO, UploadPurpose.ARTWORK] }, createdAt: { gte: cutoff } },
      select: { id: true },
    });
    const ok = new Set(found.map((u) => u.id));
    for (const [elementIndex, e] of elements.entries()) {
      if (e.uploadId && !ok.has(e.uploadId)) {
        throw unprocessable('UPLOAD_NOT_FOUND', 'The file was not found or has expired; please upload it again', {
          index,
          elementIndex,
          uploadId: e.uploadId,
        });
      }
    }
  }

  private price(product: ProductWithPricing, item: CustomOrderItemDto, index: number) {
    const variant = product.variants[0];
    const rate = unitPriceFor(variant.basePrice, variant.priceTiers, item.quantity);
    const size = parseCustomSize(product.customSize);

    let widthCm: Prisma.Decimal | null = null;
    let heightCm: Prisma.Decimal | null = null;
    let areaM2: Prisma.Decimal | null = null;
    if (size) {
      const w = item.widthCm;
      const h = item.heightCm;
      if (w === undefined || h === undefined) {
        throw unprocessable('VALIDATION_ERROR', 'Validation failed', [
          ...(w === undefined ? [{ field: `items.${index}.widthCm`, messages: ['widthCm is required for this product'] }] : []),
          ...(h === undefined ? [{ field: `items.${index}.heightCm`, messages: ['heightCm is required for this product'] }] : []),
        ]);
      }
      if (w < size.minWidthCm || w > size.maxWidthCm || h < size.minHeightCm || h > size.maxHeightCm) {
        throw unprocessable('SIZE_OUT_OF_RANGE', 'The requested size is outside the allowed range', {
          index,
          productSlug: product.slug,
          widthCm: w,
          heightCm: h,
          minWidthCm: size.minWidthCm,
          maxWidthCm: size.maxWidthCm,
          minHeightCm: size.minHeightCm,
          maxHeightCm: size.maxHeightCm,
        });
      }
      widthCm = new Prisma.Decimal(w).toDecimalPlaces(1);
      heightCm = new Prisma.Decimal(h).toDecimalPlaces(1);
      const raw = widthCm.mul(heightCm).div(10000);
      areaM2 = Prisma.Decimal.max(raw, new Prisma.Decimal(size.minBillableM2)).toDecimalPlaces(4);
    }

    if (product.pricingMode === PricingMode.PER_AREA) {
      const billable = areaM2 ?? new Prisma.Decimal(1);
      const unitPrice = billable.mul(rate).toDecimalPlaces(2);
      return { unitPrice, lineTotal: unitPrice.mul(item.quantity), widthCm, heightCm, areaM2 };
    }
    return { unitPrice: rate, lineTotal: rate.mul(item.quantity), widthCm, heightCm, areaM2 };
  }

  private toView(o: OrderWithItems): CustomOrderView {
    return {
      reference: o.reference,
      status: o.status,
      currency: o.currency,
      subtotal: money(o.subtotal),
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => {
        const elements: DesignElementView[] = i.elements.map((e) => ({
          placement: e.placement,
          kind: e.kind,
          ...(e.text !== null && { text: e.text }),
          ...(e.font !== null && { font: e.font }),
          ...(e.fontWeight !== null && { fontWeight: e.fontWeight }),
          ...(e.color !== null && { color: e.color }),
          ...(e.align !== null && { align: e.align }),
          x: e.x,
          y: e.y,
          scale: e.scale,
          rotation: e.rotation,
          sort: e.sort,
          ...(e.upload && { logoUrl: uploadUrl(e.upload.id, e.upload.purpose), originalName: e.upload.originalName }),
        }));
        const firstUpload = elements.find((e) => e.logoUrl);
        return {
          productSlug: i.productSlug,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: money(i.unitPrice),
          lineTotal: money(i.lineTotal),
          placement: elements[0]?.placement ?? i.placement,
          color: i.color,
          size: i.size,
          logoUrl: firstUpload?.logoUrl ?? null,
          ...(i.widthCm !== null && { widthCm: i.widthCm.toNumber() }),
          ...(i.heightCm !== null && { heightCm: i.heightCm.toNumber() }),
          ...(i.areaM2 !== null && { areaM2: i.areaM2.toNumber() }),
          elements,
          previews: i.previews.map((p) => ({ placement: p.placement, url: previewUrl(p.uploadId) })),
        };
      }),
    };
  }
}
