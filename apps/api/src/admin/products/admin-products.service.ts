import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, type PricingMode, type PrintPlacement, type ProductStatus } from '@prisma/client';
import { parseCustomSize, type CustomSizeConfig } from '../../catalog/placements';
import { AuditService } from '../../common/audit.service';
import { money } from '../../common/money';
import { pageMeta, parseSort, skipTake } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminActor } from '../admin-context';
import type { CreateProductDto, ListProductsQuery, PriceTierDto, UpdateProductDto } from './admin-products.dto';

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  category: { id: string; slug: string; name: string };
  basePrice: string;
  compareAtPrice: string | null;
  currency: string;
  minQty: number;
  unitLabel: string;
  colors: string[];
  sizes: string[];
  colorLabel: string;
  sizeLabel: string;
  colorsRequired: boolean;
  sizesRequired: boolean;
  placements: PrintPlacement[];
  pricingMode: PricingMode;
  supportsLogo: boolean;
  supportsText: boolean;
  supportsArtwork: boolean;
  artworkRequired: boolean;
  customSize: CustomSizeConfig | null;
  priceTiers: { minQty: number; unitPrice: string }[];
  updatedAt: string;
}

const include = {
  category: { select: { id: true, slug: true, name: true } },
  variants: {
    where: { isActive: true },
    orderBy: [{ createdAt: 'asc' as const }, { sku: 'asc' as const }],
    take: 1,
    include: { priceTiers: { orderBy: { minQty: 'asc' as const } } },
  },
} satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof include }>;

const notFound = () => new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
const invalid = (field: string, message: string) =>
  new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field, messages: [message] }] });

export function validateTiers(tiers: PriceTierDto[]): void {
  if (tiers.length < 1) throw invalid('priceTiers', 'At least one price tier is required');
  let previous = 0;
  tiers.forEach((t, i) => {
    if (t.minQty <= previous) throw invalid(`priceTiers.${i}.minQty`, 'minQty must be strictly ascending');
    previous = t.minQty;
    if (new Prisma.Decimal(t.unitPrice).lte(0)) throw invalid(`priceTiers.${i}.unitPrice`, 'unitPrice must be greater than 0');
  });
}

function validateCustomSize(raw: Record<string, number> | null | undefined): CustomSizeConfig | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const parsed = parseCustomSize(raw);
  if (!parsed) throw invalid('customSize', 'customSize needs the 7 numeric fields (minWidthCm … minBillableM2)');
  if (parsed.minWidthCm > parsed.maxWidthCm || parsed.minHeightCm > parsed.maxHeightCm) throw invalid('customSize', 'min must not exceed max');
  return parsed;
}

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  toView(p: Row): AdminProduct {
    const v = p.variants[0];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      status: p.status,
      category: p.category,
      basePrice: v ? money(v.basePrice) : '0.00',
      compareAtPrice: p.compareAtPrice ? money(p.compareAtPrice) : null,
      currency: v?.currency ?? 'HTG',
      minQty: p.minOrderQty,
      unitLabel: p.unitLabel,
      colors: p.colors,
      sizes: p.sizes,
      colorLabel: p.colorLabel,
      sizeLabel: p.sizeLabel,
      colorsRequired: p.colorsRequired,
      sizesRequired: p.sizesRequired,
      placements: p.placements,
      pricingMode: p.pricingMode,
      supportsLogo: p.supportsLogo,
      supportsText: p.supportsText,
      supportsArtwork: p.supportsArtwork,
      artworkRequired: p.artworkRequired,
      customSize: parseCustomSize(p.customSize),
      priceTiers: (v?.priceTiers ?? []).map((t) => ({ minQty: t.minQty, unitPrice: money(t.unitPrice) })),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async list(q: ListProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.q && {
        OR: [
          { name: { contains: q.q, mode: 'insensitive' } },
          { slug: { contains: q.q, mode: 'insensitive' } },
          { category: { name: { contains: q.q, mode: 'insensitive' } } },
        ],
      }),
    };
    const orderBy = parseSort<Prisma.ProductOrderByWithRelationInput>(
      q.sort,
      { name: (d) => ({ name: d }), updatedAt: (d) => ({ updatedAt: d }), createdAt: (d) => ({ createdAt: d }), status: (d) => ({ status: d }) },
      { name: 'asc' },
    );
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, include, orderBy: [orderBy, { id: 'asc' }], ...skipTake(q) }),
    ]);
    return { items: rows.map((r) => this.toView(r)), meta: pageMeta(q, total) };
  }

  async detail(id: string): Promise<AdminProduct> {
    const p = await this.prisma.product.findUnique({ where: { id }, include });
    if (!p) throw notFound();
    return this.toView(p);
  }

  async create(dto: CreateProductDto, actor: AdminActor): Promise<AdminProduct> {
    if (!dto.categoryId && !dto.categorySlug) throw invalid('categorySlug', 'categorySlug or categoryId is required');
    const category = await this.prisma.category.findFirst({ where: dto.categoryId ? { id: dto.categoryId } : { slug: dto.categorySlug } });
    if (!category) throw invalid('categorySlug', 'Unknown category');
    if (dto.priceTiers) validateTiers(dto.priceTiers);
    const customSize = validateCustomSize(dto.customSize);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            slug: dto.slug,
            name: dto.name,
            description: dto.description ?? null,
            categoryId: category.id,
            status: dto.status ?? 'DRAFT',
            minOrderQty: dto.minQty ?? 1,
            unitLabel: dto.unitLabel ?? 'pièce',
            compareAtPrice: dto.compareAtPrice ? new Prisma.Decimal(dto.compareAtPrice) : null,
            colors: dto.colors ?? [],
            sizes: dto.sizes ?? [],
            colorLabel: dto.colorLabel ?? 'Couleur',
            sizeLabel: dto.sizeLabel ?? 'Taille',
            colorsRequired: dto.colorsRequired ?? false,
            sizesRequired: dto.sizesRequired ?? false,
            placements: dto.placements ?? ['FRONT'],
            pricingMode: dto.pricingMode ?? 'PER_PIECE',
            supportsLogo: dto.supportsLogo ?? true,
            supportsText: dto.supportsText ?? true,
            supportsArtwork: dto.supportsArtwork ?? false,
            artworkRequired: dto.artworkRequired ?? false,
            customSize: customSize ? (customSize as unknown as Prisma.InputJsonObject) : Prisma.DbNull,
            variants: {
              create: {
                sku: `${dto.slug.toUpperCase()}-STD`,
                name: 'Standard',
                basePrice: new Prisma.Decimal(dto.basePrice),
                priceTiers: dto.priceTiers?.length
                  ? { create: dto.priceTiers.map((t) => ({ minQty: t.minQty, unitPrice: new Prisma.Decimal(t.unitPrice) })) }
                  : undefined,
              },
            },
          },
        });
        await this.audit.record(actor, { action: 'product.create', entityType: 'Product', entityId: p.id, metadata: { slug: p.slug } }, tx);
        return p.id;
      });
      return this.detail(id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'CONFLICT', message: 'A product with this slug already exists' });
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateProductDto, actor: AdminActor): Promise<AdminProduct> {
    const existing = await this.prisma.product.findUnique({ where: { id }, include });
    if (!existing) throw notFound();
    if (dto.priceTiers) validateTiers(dto.priceTiers);
    const customSize = validateCustomSize(dto.customSize);

    const data: Prisma.ProductUpdateInput = {};
    const changed: string[] = [];
    const set = <K extends keyof Prisma.ProductUpdateInput>(key: K, value: Prisma.ProductUpdateInput[K], label: string) => {
      data[key] = value;
      changed.push(label);
    };
    if (dto.name !== undefined) set('name', dto.name, 'name');
    if (dto.description !== undefined) set('description', dto.description, 'description');
    if (dto.status !== undefined) set('status', dto.status, 'status');
    if (dto.compareAtPrice !== undefined) set('compareAtPrice', dto.compareAtPrice === null ? null : new Prisma.Decimal(dto.compareAtPrice), 'compareAtPrice');
    if (dto.minQty !== undefined) set('minOrderQty', dto.minQty, 'minQty');
    if (dto.unitLabel !== undefined) set('unitLabel', dto.unitLabel, 'unitLabel');
    if (dto.colors !== undefined) set('colors', dto.colors, 'colors');
    if (dto.sizes !== undefined) set('sizes', dto.sizes, 'sizes');
    if (dto.colorLabel !== undefined) set('colorLabel', dto.colorLabel, 'colorLabel');
    if (dto.sizeLabel !== undefined) set('sizeLabel', dto.sizeLabel, 'sizeLabel');
    if (dto.colorsRequired !== undefined) set('colorsRequired', dto.colorsRequired, 'colorsRequired');
    if (dto.sizesRequired !== undefined) set('sizesRequired', dto.sizesRequired, 'sizesRequired');
    if (dto.placements !== undefined) set('placements', dto.placements, 'placements');
    if (dto.pricingMode !== undefined) set('pricingMode', dto.pricingMode, 'pricingMode');
    if (dto.supportsLogo !== undefined) set('supportsLogo', dto.supportsLogo, 'supportsLogo');
    if (dto.supportsText !== undefined) set('supportsText', dto.supportsText, 'supportsText');
    if (dto.supportsArtwork !== undefined) set('supportsArtwork', dto.supportsArtwork, 'supportsArtwork');
    if (dto.artworkRequired !== undefined) set('artworkRequired', dto.artworkRequired, 'artworkRequired');
    if (customSize !== undefined) set('customSize', customSize ? (customSize as unknown as Prisma.InputJsonObject) : Prisma.DbNull, 'customSize');

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.product.update({ where: { id }, data });
      const variant = existing.variants[0];
      if (variant && dto.basePrice !== undefined) {
        await tx.productVariant.update({ where: { id: variant.id }, data: { basePrice: new Prisma.Decimal(dto.basePrice) } });
        changed.push('basePrice');
      }
      if (variant && dto.priceTiers) {
        await tx.priceTier.deleteMany({ where: { variantId: variant.id } });
        await tx.priceTier.createMany({
          data: dto.priceTiers.map((t) => ({ variantId: variant.id, minQty: t.minQty, unitPrice: new Prisma.Decimal(t.unitPrice), currency: variant.currency })),
        });
        changed.push('priceTiers');
      }
      await this.audit.record(
        actor,
        {
          action: 'product.update',
          entityType: 'Product',
          entityId: id,
          metadata: {
            slug: existing.slug,
            fields: changed,
            ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
            ...(dto.priceTiers && { priceTiers: dto.priceTiers.map((t) => ({ minQty: t.minQty, unitPrice: t.unitPrice })) }),
          },
        },
        tx,
      );
    });
    return this.detail(id);
  }
}
