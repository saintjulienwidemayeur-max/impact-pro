/**
 * DEVELOPMENT / TEST SEED ONLY — never run against production.
 * Creates Impact Pro's catalog categories, a few products and a dev warehouse.
 */
import { PrismaClient, ProductStatus } from '@prisma/client';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the development seed in production');
}

const prisma = new PrismaClient();

const categories = [
  { slug: 'tasses', name: 'Tasses', description: 'Tasses céramique personnalisées par sublimation.' },
  { slug: 't-shirts-polos', name: 'T-shirts & polos', description: 'T-shirts et polos brodés ou imprimés.' },
  { slug: 'casquettes', name: 'Casquettes', description: 'Casquettes avec logo brodé.' },
  { slug: 'banderoles', name: 'Banderoles', description: 'Banderoles PVC intérieures et extérieures.' },
  { slug: 'drapeaux-plume', name: 'Drapeaux plume', description: 'Drapeaux plume pour événements et vitrines.' },
  { slug: 'cartes-papeterie', name: 'Cartes de visite & papeterie', description: 'Cartes de visite, papier à en-tête, enveloppes.' },
  { slug: 'carnets', name: 'Carnets', description: 'Carnets A5 avec logo en sérigraphie.' },
  { slug: 'stylos', name: 'Stylos', description: 'Stylos personnalisés en tampographie.' },
  { slug: 'etiquettes-sceaux', name: 'Étiquettes & sceaux', description: 'Étiquettes colis, stickers et sceaux.' },
  { slug: 'photocall', name: 'Photocall', description: 'Photocalls et panneaux d’événement « step & repeat ».' },
];

const products: Array<{
  categorySlug: string;
  slug: string;
  name: string;
  description: string;
  decorationMethod: string;
  minOrderQty: number;
  variants: Array<{ sku: string; name: string; basePrice: string; tiers: Array<[number, string]> }>;
}> = [
  {
    categorySlug: 'tasses',
    slug: 'tasse-ceramique-11oz',
    name: 'Tasse céramique 11 oz',
    description: 'Tasse blanche 11 oz, impression sublimation haute définition.',
    decorationMethod: 'sublimation',
    minOrderQty: 12,
    variants: [{ sku: 'MUG-11-WHT', name: 'Blanc', basePrice: '450.00', tiers: [[12, '450.00'], [50, '395.00'], [100, '350.00']] }],
  },
  {
    categorySlug: 't-shirts-polos',
    slug: 'polo-equipe-brode',
    name: 'Polo d’équipe brodé',
    description: 'Polo piqué avec logo brodé poitrine.',
    decorationMethod: 'broderie',
    minOrderQty: 10,
    variants: [
      { sku: 'POLO-TEAL-M', name: 'Teal · M', basePrice: '1250.00', tiers: [[10, '1250.00'], [50, '1100.00']] },
      { sku: 'POLO-WHT-M', name: 'Blanc · M', basePrice: '1200.00', tiers: [[10, '1200.00'], [50, '1050.00']] },
    ],
  },
  {
    categorySlug: 'casquettes',
    slug: 'casquette-brodee',
    name: 'Casquette brodée',
    description: 'Casquette 6 panneaux, logo brodé.',
    decorationMethod: 'broderie',
    minOrderQty: 12,
    variants: [{ sku: 'CAP-WHT', name: 'Blanc', basePrice: '750.00', tiers: [[12, '750.00'], [100, '620.00']] }],
  },
  {
    categorySlug: 'banderoles',
    slug: 'banderole-pvc-3x1-2',
    name: 'Banderole PVC extérieure 3 × 1,2 m',
    description: 'Banderole PVC avec œillets, usage extérieur.',
    decorationMethod: 'impression grand format',
    minOrderQty: 1,
    variants: [{ sku: 'BAN-PVC-300x120', name: '3 × 1,2 m', basePrice: '4500.00', tiers: [[1, '4500.00'], [5, '4000.00']] }],
  },
  {
    categorySlug: 'cartes-papeterie',
    slug: 'cartes-de-visite',
    name: 'Cartes de visite recto/verso',
    description: 'Cartes 3,5 × 2 po, papier premium, recto/verso.',
    decorationMethod: 'impression offset',
    minOrderQty: 100,
    variants: [{ sku: 'BC-35x2-100', name: 'Lot de 100', basePrice: '1500.00', tiers: [[1, '1500.00'], [5, '1300.00']] }],
  },
];

async function main(): Promise<void> {
  for (const [i, c] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, sortOrder: i },
      create: { ...c, sortOrder: i },
    });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'PAP-01' },
    update: {},
    create: { code: 'PAP-01', name: 'Entrepôt Port-au-Prince', city: 'Port-au-Prince' },
  });
  const location = await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'A-01' } },
    update: {},
    create: { warehouseId: warehouse.id, code: 'A-01', name: 'Allée A, étagère 1' },
  });

  for (const p of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.categorySlug } });
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        decorationMethod: p.decorationMethod,
        minOrderQty: p.minOrderQty,
        status: ProductStatus.ACTIVE,
        categoryId: category.id,
      },
    });
    for (const v of p.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: { productId: product.id, sku: v.sku, name: v.name, basePrice: v.basePrice },
      });
      for (const [minQty, unitPrice] of v.tiers) {
        await prisma.priceTier.upsert({
          where: { variantId_minQty: { variantId: variant.id, minQty } },
          update: { unitPrice },
          create: { variantId: variant.id, minQty, unitPrice },
        });
      }
      await prisma.inventoryItem.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
        update: {},
        create: { variantId: variant.id, locationId: location.id, onHand: 200, reorderPoint: 25 },
      });
    }
  }
  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
