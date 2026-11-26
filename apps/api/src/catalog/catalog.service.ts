import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, type PricingMode, type PrintPlacement } from '@prisma/client';
import { money } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_ELEMENTS_PER_ZONE, PLACEMENT_LABELS, parseCustomSize, type CustomSizeConfig } from './placements';

export interface PriceTierView {
  minQty: number;
  unitPrice: string;
}

export interface CatalogProductView {
  slug: string;
  name: string;
  description: string | null;
  category: { slug: string; name: string };
  basePrice: string;
  compareAtPrice: string | null;
  currency: string;
  minQty: number;
  unitLabel: string;
  /** Selector label (« Couleur », « Couleur du toit »…); the selector only exists when `colors` is non-empty. */
  colorLabel: string;
  colors: string[];
  colorsRequired: boolean;
  /** Selector label (« Taille », « Modèle du téléphone », « Dimensions »…); only meaningful when `sizes` is non-empty. */
  sizeLabel: string;
  sizes: string[];
  sizesRequired: boolean;
  placements: PrintPlacement[];
  priceTiers: PriceTierView[];
  images: string[];
  /** PER_AREA: priceTiers.unitPrice is HTG per m². */
  pricingMode: PricingMode;
  supportsLogo: boolean;
  supportsText: boolean;
  supportsArtwork: boolean;
  artworkRequired: boolean;
  customSize: CustomSizeConfig | null;
  zones: { placement: PrintPlacement; label: string; maxElements: number }[];
}

const productInclude = {
  category: { select: { slug: true, name: true } },
  variants: {
    where: { isActive: true },
    orderBy: [{ createdAt: 'asc' as const }, { sku: 'asc' as const }],
    take: 1,
    include: { priceTiers: { orderBy: { minQty: 'asc' as const } } },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithPricing = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * Unit price for a quantity: the tier with the highest minQty ≤ quantity wins; otherwise the base price.
 * Pricing always comes from the database — never from the client.
 */
export function unitPriceFor(
  basePrice: Prisma.Decimal,
  tiers: ReadonlyArray<{ minQty: number; unitPrice: Prisma.Decimal }>,
  quantity: number,
): Prisma.Decimal {
  let price = basePrice;
  let best = -1;
  for (const t of tiers) {
    if (t.minQty <= quantity && t.minQty > best) {
      best = t.minQty;
      price = t.unitPrice;
    }
  }
  return price;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { page: number; pageSize: number; category?: string; q?: string }) {
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      variants: { some: { isActive: true } },
      ...(params.category && { category: { slug: params.category } }),
      ...(params.q && {
        OR: [
          { name: { contains: params.q, mode: 'insensitive' } },
          { description: { contains: params.q, mode: 'insensitive' } },
          { category: { name: { contains: params.q, mode: 'insensitive' } } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return { items: rows.map((p) => this.toView(p)), total };
  }

  async getBySlug(slug: string): Promise<CatalogProductView> {
    return this.toView(await this.findActiveForPricing(slug));
  }

  /** Loads an orderable product with its default variant and tiers, or throws PRODUCT_NOT_FOUND. */
  async findActiveForPricing(slug: string, tx: Prisma.TransactionClient = this.prisma): Promise<ProductWithPricing> {
    const product = await tx.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: productInclude,
    });
    if (!product || product.variants.length === 0) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: `Product "${slug}" not found`, details: { slug } });
    }
    return product;
  }

  toView(p: ProductWithPricing): CatalogProductView {
    const variant = p.variants[0];
    return {
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: { slug: p.category.slug, name: p.category.name },
      basePrice: money(variant.basePrice),
      compareAtPrice: p.compareAtPrice ? money(p.compareAtPrice) : null,
      currency: variant.currency,
      minQty: p.minOrderQty,
      unitLabel: p.unitLabel,
      colorLabel: p.colorLabel,
      colors: p.colors,
      colorsRequired: p.colorsRequired,
      sizeLabel: p.sizeLabel,
      sizes: p.sizes,
      sizesRequired: p.sizesRequired,
      placements: p.placements,
      priceTiers: variant.priceTiers.map((t) => ({ minQty: t.minQty, unitPrice: money(t.unitPrice) })),
      images: p.images,
      pricingMode: p.pricingMode,
      supportsLogo: p.supportsLogo,
      supportsText: p.supportsText,
      supportsArtwork: p.supportsArtwork,
      artworkRequired: p.artworkRequired,
      customSize: parseCustomSize(p.customSize),
      zones: p.placements.map((placement) => ({ placement, label: PLACEMENT_LABELS[placement], maxElements: MAX_ELEMENTS_PER_ZONE })),
    };
  }
}
