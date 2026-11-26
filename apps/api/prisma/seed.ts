/**
 * DEVELOPMENT / TEST SEED ONLY — never run against production.
 * Creates Impact Pro's catalog (categories + orderable products with price tiers) and a dev warehouse.
 * Idempotent: re-running updates products in place (upsert by slug / sku).
 *
 * ⚠️ ALL PRICES BELOW ARE PLACEHOLDERS (HTG) chosen to look realistic for development.
 *    Real prices must be entered by Impact Pro staff (admin dashboard, Phase 5) before launch.
 */
import { PricingMode, PrintPlacement, Prisma, PrismaClient, ProductStatus } from '@prisma/client';

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
  { slug: 'ballons', name: 'Ballons', description: 'Ballons latex imprimés à vos couleurs pour vos événements.' },
  { slug: 'tentes', name: 'Tentes & parasols', description: 'Tentes pliantes imprimées pour marchés, foires et événements.' },
  { slug: 'affichage', name: 'Roll-ups & affichage', description: 'Roll-ups, affiches et supports d’affichage.' },
  { slug: 'sacs', name: 'Sacs', description: 'Sacs tote et sacs à cordon personnalisés.' },
  { slug: 'gourdes-gobelets', name: 'Gourdes & gobelets', description: 'Gourdes et gobelets isothermes personnalisés.' },
  { slug: 'accessoires', name: 'Accessoires & cadeaux', description: 'Parapluies, clés USB, porte-clés, tabliers et cadeaux d’entreprise.' },
];

const { FRONT, BACK, CHEST_LEFT, SLEEVE, WRAP, FULL, SIDE, TOP } = PrintPlacement;
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
  // Customizer v2 (defaults: PER_PIECE, logo + text, no artwork)
  pricingMode?: PricingMode;
  supportsLogo?: boolean;
  supportsText?: boolean;
  supportsArtwork?: boolean;
  artworkRequired?: boolean;
  /** When set the customer enters width × height (cm); with PER_AREA the tiers are HTG per m². */
  customSize?: {
    minWidthCm: number;
    maxWidthCm: number;
    minHeightCm: number;
    maxHeightCm: number;
    defaultWidthCm: number;
    defaultHeightCm: number;
    minBillableM2: number;
  };
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
    placements: [FRONT, BACK, CHEST_LEFT, SLEEVE],
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
    placements: [FRONT, BACK, CHEST_LEFT, SLEEVE],
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
    placements: [FRONT, SIDE, BACK],
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
    basePrice: '2800.00', // PLACEHOLDER: HTG per m²
    tiers: [[1, '2800.00'], [5, '2500.00'], [10, '2200.00']], // PLACEHOLDER: HTG per m², by quantity
    sizes: ['2 × 1 m', '3 × 1,2 m', '4 × 1,5 m'],
    placements: [FULL],
    images: ['/photos/banderole-pvc.jpg'],
    pricingMode: PricingMode.PER_AREA,
    supportsArtwork: true,
    artworkRequired: true,
    customSize: { minWidthCm: 50, maxWidthCm: 1000, minHeightCm: 50, maxHeightCm: 500, defaultWidthCm: 300, defaultHeightCm: 120, minBillableM2: 1 },
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
    supportsArtwork: true,
    artworkRequired: true,
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
    supportsArtwork: true, // print-ready file accepted (not required)
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
    supportsArtwork: true,
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
    placements: [FRONT, BACK],
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
    supportsArtwork: true,
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
    basePrice: '3100.00', // PLACEHOLDER: HTG per m²
    tiers: [[1, '3100.00'], [2, '2800.00']], // PLACEHOLDER: HTG per m², by quantity
    sizes: ['2 × 2 m', '3 × 2,25 m'],
    placements: [FULL],
    images: ['/photos/photocall-evenement.jpg', '/photos/photocall-fichier.jpg'],
    pricingMode: PricingMode.PER_AREA,
    supportsArtwork: true,
    artworkRequired: true,
    customSize: { minWidthCm: 100, maxWidthCm: 600, minHeightCm: 100, maxHeightCm: 400, defaultWidthCm: 300, defaultHeightCm: 225, minBillableM2: 2 },
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
  // ── Customizer v2: new products. ALL PRICES ARE PLACEHOLDERS (HTG). Photos may not exist yet (storefront shows a tile). ──
  {
    categorySlug: 'ballons',
    slug: 'ballon-personnalise',
    name: 'Ballon personnalisé',
    description: 'Ballon latex 12 po imprimé en 1 ou 2 faces, idéal pour vos inaugurations, fêtes et campagnes.',
    decorationMethod: 'impression sérigraphie',
    minOrderQty: 100,
    unitLabel: 'ballon',
    basePrice: '45.00',
    tiers: [[100, '45.00'], [500, '38.00'], [1000, '32.00']],
    colors: ['Blanc', 'Rouge', 'Bleu', 'Jaune', 'Vert', 'Noir', 'Rose', 'Teal'],
    placements: [FRONT, BACK],
    images: ['/photos/ballon-personnalise.webp'],
    leadTimeDays: 5,
  },
  {
    categorySlug: 'tentes',
    slug: 'tente-pliante-3x3',
    name: 'Tente pliante personnalisée',
    description: 'Tente pliante structure aluminium, toit et côtés imprimés à votre marque. Sac de transport inclus.',
    decorationMethod: 'sublimation textile',
    minOrderQty: 1,
    unitLabel: 'tente',
    basePrice: '28500.00',
    tiers: [[1, '28500.00'], [3, '26500.00'], [10, '24500.00']],
    colors: ['Blanc', 'Bleu', 'Rouge', 'Teal'],
    sizes: ['3 × 3 m', '3 × 4,5 m', '3 × 6 m'],
    placements: [TOP, SIDE, FRONT, BACK],
    supportsArtwork: true,
    images: ['/photos/tente-pliante-3x3.webp'],
    leadTimeDays: 10,
  },
  {
    categorySlug: 'affichage',
    slug: 'roll-up',
    name: 'Roll-up',
    description: 'Roll-up enrouleur avec housse, impression grand format. Envoyez votre visuel prêt à imprimer.',
    decorationMethod: 'impression grand format',
    minOrderQty: 1,
    unitLabel: 'roll-up',
    basePrice: '6500.00',
    tiers: [[1, '6500.00'], [5, '5800.00'], [10, '5200.00']],
    sizes: ['85 × 200 cm', '100 × 200 cm'],
    placements: [FRONT],
    supportsArtwork: true,
    artworkRequired: true,
    images: ['/photos/roll-up.webp'],
    leadTimeDays: 5,
  },
  {
    categorySlug: 'etiquettes-sceaux',
    slug: 'autocollants',
    name: 'Autocollants sur mesure',
    description: 'Autocollants vinyle découpés à la forme, à la taille de votre choix.',
    decorationMethod: 'impression numérique',
    minOrderQty: 50,
    unitLabel: 'autocollant',
    basePrice: '12000.00', // PLACEHOLDER: HTG per m²
    tiers: [[50, '12000.00'], [250, '10000.00'], [1000, '8500.00']], // PLACEHOLDER: HTG per m², by quantity
    placements: [FRONT],
    pricingMode: PricingMode.PER_AREA,
    supportsArtwork: true,
    customSize: { minWidthCm: 2, maxWidthCm: 100, minHeightCm: 2, maxHeightCm: 100, defaultWidthCm: 5, defaultHeightCm: 5, minBillableM2: 0.0025 },
    images: ['/photos/autocollants.webp'],
    leadTimeDays: 4,
  },
  {
    categorySlug: 'cartes-papeterie',
    slug: 'flyers-brochures',
    name: 'Flyers & brochures',
    description: 'Flyers, dépliants et brochures, papier couché, recto/verso.',
    decorationMethod: 'impression offset',
    minOrderQty: 1,
    unitLabel: 'lot de 100',
    basePrice: '1500.00',
    tiers: [[1, '1500.00'], [5, '1300.00'], [10, '1100.00']],
    sizes: ['A6', 'A5', 'A4'],
    placements: [FRONT, BACK],
    supportsArtwork: true,
    images: ['/photos/flyers-brochures.webp'],
    leadTimeDays: 3,
  },
  {
    categorySlug: 'sacs',
    slug: 'sac-tote',
    name: 'Sac tote',
    description: 'Sac shopping en tissu non tissé ou coton, anses longues, impression devant et dos.',
    decorationMethod: 'sérigraphie',
    minOrderQty: 25,
    unitLabel: 'pièce',
    basePrice: '450.00',
    tiers: [[25, '450.00'], [100, '390.00'], [250, '340.00']],
    colors: ['Bleu royal', 'Noir', 'Naturel', 'Teal'],
    placements: [FRONT, BACK],
    images: ['/photos/sac-tote.webp'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 'sacs',
    slug: 'sac-a-cordon',
    name: 'Sac à cordon',
    description: 'Sac à dos à cordon en polyester, léger et pratique pour vos événements.',
    decorationMethod: 'sérigraphie',
    minOrderQty: 25,
    unitLabel: 'pièce',
    basePrice: '380.00',
    tiers: [[25, '380.00'], [100, '330.00'], [250, '290.00']],
    colors: ['Bleu royal', 'Noir', 'Rouge', 'Teal'],
    placements: [FRONT, BACK],
    images: ['/photos/sac-a-cordon.webp'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 'accessoires',
    slug: 'parapluie',
    name: 'Parapluie personnalisé',
    description: 'Parapluie pliant, toile imprimée à votre logo.',
    decorationMethod: 'impression numérique',
    minOrderQty: 10,
    unitLabel: 'pièce',
    basePrice: '1250.00',
    tiers: [[10, '1250.00'], [50, '1100.00'], [100, '980.00']],
    colors: ['Bleu royal', 'Noir', 'Rouge', 'Teal'],
    placements: [FRONT, TOP],
    images: ['/photos/parapluie.webp'],
    leadTimeDays: 10,
  },
  {
    categorySlug: 'gourdes-gobelets',
    slug: 'gourde-isotherme',
    name: 'Gourde isotherme',
    description: 'Gourde inox double paroi 500 ml, garde le chaud et le froid, gravure ou impression.',
    decorationMethod: 'gravure / impression',
    minOrderQty: 25,
    unitLabel: 'pièce',
    basePrice: '950.00',
    tiers: [[25, '950.00'], [100, '850.00'], [250, '760.00']],
    colors: ['Bleu', 'Noir', 'Blanc', 'Teal'],
    placements: [WRAP, FRONT],
    images: ['/photos/gourde-isotherme.webp'],
    leadTimeDays: 10,
  },
  {
    categorySlug: 'gourdes-gobelets',
    slug: 'gobelet-isotherme',
    name: 'Gobelet isotherme',
    description: 'Gobelet de voyage isotherme avec couvercle, personnalisable sur tout le tour.',
    decorationMethod: 'impression',
    minOrderQty: 25,
    unitLabel: 'pièce',
    basePrice: '800.00',
    tiers: [[25, '800.00'], [100, '720.00'], [250, '650.00']],
    colors: ['Bleu', 'Noir', 'Blanc'],
    placements: [WRAP, FRONT],
    images: ['/photos/gobelet-isotherme.webp'],
    leadTimeDays: 10,
  },
  {
    categorySlug: 'accessoires',
    slug: 'cle-usb',
    name: 'Clé USB personnalisée',
    description: 'Clé USB pivotante avec votre logo, capacités 8, 16 ou 32 Go.',
    decorationMethod: 'tampographie / gravure laser',
    minOrderQty: 25,
    unitLabel: 'pièce',
    basePrice: '700.00',
    tiers: [[25, '700.00'], [100, '620.00'], [250, '560.00']],
    colors: ['Bleu', 'Noir', 'Rouge'],
    sizes: ['8 Go', '16 Go', '32 Go'],
    placements: [FRONT],
    images: ['/photos/cle-usb.webp'],
    leadTimeDays: 10,
  },
  {
    categorySlug: 'accessoires',
    slug: 'porte-cles',
    name: 'Porte-clés',
    description: 'Porte-clés PVC ou métal, impression recto/verso.',
    decorationMethod: 'impression',
    minOrderQty: 50,
    unitLabel: 'pièce',
    basePrice: '180.00',
    tiers: [[50, '180.00'], [250, '150.00'], [500, '130.00']],
    colors: ['Bleu', 'Rouge', 'Noir', 'Blanc'],
    placements: [FRONT, BACK],
    images: ['/photos/porte-cles.webp'],
    leadTimeDays: 7,
  },
  {
    categorySlug: 'accessoires',
    slug: 'protege-passeport',
    name: 'Protège-passeport',
    description: 'Étui de passeport simili-cuir avec votre logo.',
    decorationMethod: 'impression / gaufrage',
    minOrderQty: 25,
    unitLabel: 'pièce',
    basePrice: '520.00',
    tiers: [[25, '520.00'], [100, '470.00'], [250, '420.00']],
    colors: ['Bleu', 'Noir', 'Rouge'],
    placements: [FRONT],
    images: ['/photos/protege-passeport.webp'],
    leadTimeDays: 10,
  },
  {
    categorySlug: 'accessoires',
    slug: 'tablier',
    name: 'Tablier personnalisé',
    description: 'Tablier de cuisine ou de service, brodé ou imprimé devant et dos.',
    decorationMethod: 'broderie / sérigraphie',
    minOrderQty: 12,
    unitLabel: 'pièce',
    basePrice: '780.00',
    tiers: [[12, '780.00'], [50, '690.00'], [100, '620.00']],
    colors: ['Noir', 'Blanc', 'Teal', 'Bleu'],
    placements: [FRONT, BACK],
    images: ['/photos/tablier.webp'],
    leadTimeDays: 7,
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
      pricingMode: p.pricingMode ?? PricingMode.PER_PIECE,
      supportsLogo: p.supportsLogo ?? true,
      supportsText: p.supportsText ?? true,
      supportsArtwork: p.supportsArtwork ?? false,
      artworkRequired: p.artworkRequired ?? false,
      customSize: p.customSize ?? Prisma.DbNull,
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
