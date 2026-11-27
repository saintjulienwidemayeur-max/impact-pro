/**
 * DEVELOPMENT / TEST SEED ONLY — never run against production.
 * Creates Impact Pro's catalog (categories + orderable products with price tiers) and a dev warehouse.
 * Idempotent: re-running updates products in place (upsert by slug / sku).
 *
 * ⚠️ ALL PRICES BELOW ARE PLACEHOLDERS (HTG) chosen to look realistic for development.
 *    Real prices must be entered by Impact Pro staff (admin dashboard, Phase 5) before launch.
 */
import { Algorithm, hash } from '@node-rs/argon2';
import { PricingMode, Prisma, PrismaClient, ProductStatus } from '@prisma/client';
import { categories, optionFlags, products } from './seed-data';

// Guard: this loads placeholder catalog data and a dev warehouse. In production it needs an explicit opt-in
// (ALLOW_DEMO_SEED=true), meant only for demo/staging deployments.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Refusing to run the development seed in production (set ALLOW_DEMO_SEED=true for a demo deployment)');
}

const prisma = new PrismaClient();

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
      ...optionFlags(p),
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

  await seedDemoStaff();
}

/** One demo staff account per role. Development/test only, password from DEV_STAFF_PASSWORD (never committed). */
async function seedDemoStaff(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  const password = process.env.DEV_STAFF_PASSWORD;
  if (!password) {
    console.log('Demo staff accounts skipped: set DEV_STAFF_PASSWORD (min 12 chars) to create one account per role.');
    return;
  }
  if (password.length < 12) {
    console.log('Demo staff accounts skipped: DEV_STAFF_PASSWORD must have at least 12 characters.');
    return;
  }
  const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const roles = ['SUPER_ADMIN', 'ADMIN', 'SALES', 'ACCOUNTING', 'PRODUCTION', 'SUPPORT'] as const;
  for (const role of roles) {
    const email = `${role.toLowerCase().replace('_', '-')}@dev.impactpro.test`;
    await prisma.user.upsert({
      where: { email },
      update: { isStaff: true, staffRole: role, passwordHash, mustChangePassword: false },
      create: { email, fullName: `Démo ${role}`, isStaff: true, staffRole: role, passwordHash },
    });
  }
  console.log(`Demo staff accounts ready (${roles.length}): <role>@dev.impactpro.test, e.g. super-admin@dev.impactpro.test`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
