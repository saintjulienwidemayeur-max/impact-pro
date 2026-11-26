/**
 * DEVELOPMENT / TEST SEED ONLY — never run against production.
 * Creates Impact Pro's catalog (categories + orderable products with price tiers) and a dev warehouse.
 * Idempotent: re-running updates products in place (upsert by slug / sku).
 *
 * ⚠️ ALL PRICES BELOW ARE PLACEHOLDERS (HTG) chosen to look realistic for development.
 *    Real prices must be entered by Impact Pro staff (admin dashboard, Phase 5) before launch.
 */
import { PrintPlacement, PrismaClient, ProductStatus } from '@prisma/client';

// Guard: this loads placeholder catalog data and a dev warehouse. In production it needs an explicit opt-in
// (ALLOW_DEMO_SEED=true), meant only for demo/staging deployments.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Refusing to run the development seed in production (set ALLOW_DEMO_SEED=true for a demo deployment)');
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
  { slug: 'kits', name: 'Kits d’entreprise', description: 'Coffrets d’articles assortis à vos couleurs.' },
];

const { FRONT, BACK, CHEST_LEFT, SLEEVE, WRAP, FULL } = PrintPlacement;
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

interface SeedProduct {
  categorySlug: string;
  slug: string;
  name: string;
  description: string;
  decorationMethod: string;
  minOrderQty: number;
  unitLabel: string;
  basePrice: string; // placeholder
  compareAtPrice?: string; // placeholder
  tiers: Array<[minQty: number, unitPrice: string]>; // placeholder
  colors?: string[];
  sizes?: string[];
  placements: PrintPlacement[];
  images: string[];
  leadTimeDays: number;
}

const products: SeedProduct[] = [
  {
    categorySlug: 'tasses',
    slug: 'tasse-ceramique-11oz',
    name: 'Tasse céramique 11 oz',
    description: 'Tasse blanche 11 oz, impression sublimation pleine couleur, passe au lave-vaisselle.',
    decorationMethod: 'sublimation',
    minOrderQty: 12,
    unitLabel: 'pièce',
    basePrice: '650.00',
    compareAtPrice: '900.00',
    tiers: [[12, '650.00'], [50, '575.00'], [100, '495.00']],
    colors: ['Blanc'],
    placements: [FRONT, WRAP],
    images: ['/photos/tasse-11oz.webp', '/photos/tasses-serie.webp'],
    leadTimeDays: 5,
  },
  {
    categorySlug: 't-shirts-polos',
    slug: 'polo-brode',
    name: 'Polo brodé',
    description: 'Polo piqué 100 % coton, logo brodé cœur et option dos.',
    decorationMethod: 'broderie',
    minOrderQty: 10,
    unitLabel: 'pièce',
    basePrice: '1450.00',
    compareAtPrice: '1950.00',
    tiers: [[10, '1450.00'], [50, '1300.00'], [100, '1150.00']],
    colors: ['Teal', 'Blanc', 'Noir', 'Bleu royal'],
    sizes: SIZES,
    placements: [CHEST_LEFT, BACK, SLEEVE],
    images: ['/photos/polo-equipe-teal.webp', '/photos/polo-blanc-brode.webp'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 't-shirts-polos',
    slug: 't-shirt-personnalise',
    name: 'T-shirt personnalisé',
    description: 'T-shirt coton col rond, impression sérigraphie ou transfert.',
    decorationMethod: 'sérigraphie',
    minOrderQty: 12,
    unitLabel: 'pièce',
    basePrice: '750.00',
    compareAtPrice: '950.00',
    tiers: [[12, '750.00'], [50, '650.00'], [100, '575.00']],
    colors: ['Blanc', 'Noir', 'Teal', 'Cyan', 'Jaune'],
    sizes: SIZES,
    placements: [FRONT, BACK, CHEST_LEFT],
    images: ['/photos/polo-blanc-brode.webp'],
    leadTimeDays: 5,
  },
  {
    categorySlug: 'casquettes',
    slug: 'casquette-brodee',
    name: 'Casquette brodée',
    description: 'Casquette 6 panneaux en coton brossé, logo brodé, fermeture réglable.',
    decorationMethod: 'broderie',
    minOrderQty: 12,
    unitLabel: 'pièce',
    basePrice: '850.00',
    compareAtPrice: '1200.00',
    tiers: [[12, '850.00'], [50, '750.00'], [100, '650.00']],
    colors: ['Blanc', 'Noir', 'Teal', 'Bleu royal'],
    placements: [FRONT],
    images: ['/photos/casquette-brodee.webp'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 'banderoles',
    slug: 'banderole-pvc',
    name: 'Banderole PVC extérieure',
    description: 'Banderole PVC 440 g avec œillets, résistante aux intempéries.',
    decorationMethod: 'impression grand format',
    minOrderQty: 1,
    unitLabel: 'banderole',
    basePrice: '8500.00',
    compareAtPrice: '11500.00',
    tiers: [[1, '8500.00'], [5, '7500.00'], [10, '6900.00']],
    sizes: ['2 × 1 m', '3 × 1,2 m', '4 × 1,5 m'],
    placements: [FULL],
    images: ['/photos/banderole-pvc.jpg'],
    leadTimeDays: 3,
  },
  {
    categorySlug: 'drapeaux-plume',
    slug: 'drapeau-plume',
    name: 'Drapeau plume',
    description: 'Drapeau plume avec mât et pied, impression recto, visible de loin.',
    decorationMethod: 'sublimation textile',
    minOrderQty: 1,
    unitLabel: 'drapeau',
    basePrice: '12500.00',
    tiers: [[1, '12500.00'], [3, '11500.00'], [10, '10500.00']],
    colors: ['Blanc', 'Teal', 'Jaune'],
    sizes: ['2,8 m', '3,5 m'],
    placements: [FULL],
    images: ['/photos/drapeaux-plume.webp'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 'cartes-papeterie',
    slug: 'cartes-de-visite',
    name: 'Cartes de visite recto/verso',
    description: 'Cartes 3,5 × 2 po, papier premium 350 g, impression recto/verso.',
    decorationMethod: 'impression offset',
    minOrderQty: 1,
    unitLabel: 'lot de 100',
    basePrice: '1800.00',
    compareAtPrice: '2500.00',
    tiers: [[1, '1800.00'], [5, '1500.00'], [10, '1300.00']],
    placements: [FRONT, BACK],
    images: ['/photos/carte-visite-recto.jpg', '/photos/carte-visite-verso.jpg'],
    leadTimeDays: 3,
  },
  {
    categorySlug: 'cartes-papeterie',
    slug: 'papier-en-tete',
    name: 'Papier à en-tête A4',
    description: 'Papier à en-tête A4 90 g à vos couleurs.',
    decorationMethod: 'impression offset',
    minOrderQty: 1,
    unitLabel: 'lot de 100',
    basePrice: '2200.00',
    tiers: [[1, '2200.00'], [5, '1900.00']],
    placements: [FRONT],
    images: ['/photos/papier-entete.jpg'],
    leadTimeDays: 3,
  },
  {
    categorySlug: 'carnets',
    slug: 'carnet-a5',
    name: 'Carnet A5',
    description: 'Carnet A5 couverture souple, élastique et porte-stylo, logo en sérigraphie.',
    decorationMethod: 'sérigraphie',
    minOrderQty: 10,
    unitLabel: 'pièce',
    basePrice: '1100.00',
    compareAtPrice: '1450.00',
    tiers: [[10, '1100.00'], [50, '950.00'], [100, '850.00']],
    colors: ['Teal', 'Noir', 'Bleu'],
    placements: [FRONT],
    images: ['/photos/carnet-a5.webp'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 'stylos',
    slug: 'stylos-personnalises',
    name: 'Stylos personnalisés',
    description: 'Stylos bille avec logo en tampographie.',
    decorationMethod: 'tampographie',
    minOrderQty: 50,
    unitLabel: 'pièce',
    basePrice: '95.00',
    tiers: [[50, '95.00'], [250, '80.00'], [500, '70.00']],
    colors: ['Blanc', 'Bleu', 'Noir'],
    placements: [FRONT],
    images: ['/photos/stylos.webp'],
    leadTimeDays: 5,
  },
  {
    categorySlug: 'etiquettes-sceaux',
    slug: 'etiquettes-sceaux',
    name: 'Étiquettes & sceaux',
    description: 'Étiquettes adhésives rondes pour colis, emballages et remerciements.',
    decorationMethod: 'impression numérique',
    minOrderQty: 1,
    unitLabel: 'rouleau de 250',
    basePrice: '2500.00',
    tiers: [[1, '2500.00'], [4, '2200.00']],
    sizes: ['5 cm', '7,5 cm'],
    placements: [FRONT],
    images: ['/photos/etiquettes-sceaux.jpg'],
    leadTimeDays: 4,
  },
  {
    categorySlug: 'photocall',
    slug: 'photocall',
    name: 'Photocall « step & repeat »',
    description: 'Mur photo événementiel avec structure, motif logo répété.',
    decorationMethod: 'impression grand format',
    minOrderQty: 1,
    unitLabel: 'photocall',
    basePrice: '18500.00',
    tiers: [[1, '18500.00'], [2, '16500.00']],
    sizes: ['2 × 2 m', '3 × 2,25 m'],
    placements: [FULL],
    images: ['/photos/photocall-evenement.jpg', '/photos/photocall-fichier.jpg'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 'kits',
    slug: 'kit-entreprise',
    name: 'Kit d’entreprise',
    description: 'Coffret personnalisé : polo, casquette, gourde, carnet, stylo et sac — à vos couleurs.',
    decorationMethod: 'mixte',
    minOrderQty: 10,
    unitLabel: 'kit',
    basePrice: '4500.00',
    tiers: [[10, '4500.00'], [50, '3950.00'], [100, '3500.00']],
    placements: [FRONT],
    images: ['/photos/kit-promotionnel.webp'],
    leadTimeDays: 10,
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
    const fields = {
      name: p.name,
      description: p.description,
      decorationMethod: p.decorationMethod,
      minOrderQty: p.minOrderQty,
      unitLabel: p.unitLabel,
      compareAtPrice: p.compareAtPrice ?? null,
      colors: p.colors ?? [],
      sizes: p.sizes ?? [],
      placements: p.placements,
      images: p.images,
      leadTimeDays: p.leadTimeDays,
      status: ProductStatus.ACTIVE,
      categoryId: category.id,
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: fields,
      create: { slug: p.slug, ...fields },
    });

    // One orderable "standard" variant per product carries the base price and quantity tiers.
    const sku = `IP-${p.slug.toUpperCase()}`;
    const variant = await prisma.productVariant.upsert({
      where: { sku },
      update: { basePrice: p.basePrice, isActive: true, name: 'Standard' },
      create: { productId: product.id, sku, name: 'Standard', basePrice: p.basePrice },
    });
    // Older seed variants of the same product are deactivated (not deleted: inventory history may reference them).
    await prisma.productVariant.updateMany({
      where: { productId: product.id, id: { not: variant.id } },
      data: { isActive: false },
    });
    await prisma.priceTier.deleteMany({
      where: { variantId: variant.id, minQty: { notIn: p.tiers.map(([q]) => q) } },
    });
    for (const [minQty, unitPrice] of p.tiers) {
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

  // Products from earlier seed versions that are no longer in the list are archived, not deleted.
  const archived = await prisma.product.updateMany({
    where: { slug: { notIn: products.map((p) => p.slug) }, status: ProductStatus.ACTIVE, category: { slug: { in: categories.map((c) => c.slug) } } },
    data: { status: ProductStatus.ARCHIVED },
  });

  console.log(
    `Seeded ${categories.length} categories and ${products.length} products` +
      (archived.count ? ` (archived ${archived.count} obsolete product(s))` : '') +
      '. Prices are placeholders.',
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
