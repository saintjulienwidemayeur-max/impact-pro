import type { INestApplication } from '@nestjs/common';
import { PrintPlacement, PrismaClient, ProductStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

/** 1×1 transparent PNG. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF_MIN = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

describe('Uploads, catalog & custom orders (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  const mugSlug = `tasse-e2e-${suffix}`;
  const bannerSlug = `banderole-e2e-${suffix}`;
  const draftSlug = `brouillon-e2e-${suffix}`;
  const categorySlug = `cat-e2e-${suffix}`;
  let app: INestApplication;

  async function uploadPng(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/uploads/logos')
      .attach('file', PNG_1x1, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);
    return res.body.data.id as string;
  }

  function orderBody(items: unknown[], email = 'Client@Example.com') {
    return {
      customer: { fullName: 'Marie Joseph', company: 'Boulangerie Soleil', phone: '+509 3712-3456', email, city: 'Port-au-Prince' },
      items,
      deliveryMethod: 'DELIVERY',
      notes: 'Livraison le matin',
    };
  }

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.create({ data: { name: 'Catégorie e2e', slug: categorySlug } });
    const mug = await prisma.product.create({
      data: {
        slug: mugSlug,
        name: 'Tasse e2e',
        description: 'Tasse de test',
        categoryId: category.id,
        status: ProductStatus.ACTIVE,
        minOrderQty: 12,
        unitLabel: 'pièce',
        compareAtPrice: '900.00',
        colors: ['Blanc'],
        placements: [PrintPlacement.FRONT, PrintPlacement.WRAP],
        images: ['/photos/tasse-11oz.jpg'],
      },
    });
    await prisma.productVariant.create({
      data: {
        productId: mug.id,
        sku: `E2E-MUG-${suffix}`,
        name: 'Standard',
        basePrice: '650.00',
        priceTiers: { create: [{ minQty: 12, unitPrice: '650.00' }, { minQty: 50, unitPrice: '575.00' }, { minQty: 100, unitPrice: '495.00' }] },
      },
    });
    const banner = await prisma.product.create({
      data: {
        slug: bannerSlug,
        name: 'Banderole e2e',
        categoryId: category.id,
        status: ProductStatus.ACTIVE,
        minOrderQty: 1,
        unitLabel: 'banderole',
        sizes: ['3 × 1,2 m'],
        placements: [PrintPlacement.FULL],
      },
    });
    await prisma.productVariant.create({
      data: { productId: banner.id, sku: `E2E-BAN-${suffix}`, name: 'Standard', basePrice: '8500.00' },
    });
    const draft = await prisma.product.create({
      data: { slug: draftSlug, name: 'Brouillon', categoryId: category.id, status: ProductStatus.DRAFT },
    });
    await prisma.productVariant.create({
      data: { productId: draft.id, sku: `E2E-DRAFT-${suffix}`, name: 'Standard', basePrice: '1.00' },
    });
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/uploads/logos', () => {
    it('accepts a PNG, detects its type and dimensions, and serves it back', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/uploads/logos')
        .attach('file', PNG_1x1, { filename: '../../etc/mon logo.png', contentType: 'image/png' })
        .expect(201);
      const { id, url, mimeType, size, originalName } = res.body.data;
      expect(url).toBe(`/api/v1/uploads/logos/${id}`);
      expect(mimeType).toBe('image/png');
      expect(size).toBe(PNG_1x1.length);
      expect(originalName).toBe('mon logo.png');
      const row = await prisma.upload.findUniqueOrThrow({ where: { id } });
      expect(row.width).toBe(1);
      expect(row.storageKey).toBe(`logos/${id}`);

      const file = await request(app.getHttpServer()).get(url).buffer(true).expect(200);
      expect(file.headers['content-type']).toBe('image/png');
      expect(file.headers['x-content-type-options']).toBe('nosniff');
      expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(file.headers['content-disposition']).toMatch(/^inline/);
      expect(Buffer.compare(file.body as Buffer, PNG_1x1)).toBe(0);
    });

    it('accepts a PDF and serves it as an attachment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/uploads/logos')
        .attach('file', PDF_MIN, { filename: 'logo.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(res.body.data.mimeType).toBe('application/pdf');
      const file = await request(app.getHttpServer()).get(res.body.data.url).expect(200);
      expect(file.headers['content-disposition']).toMatch(/^attachment/);
    });

    it('rejects SVG even when declared as an image', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/uploads/logos')
        .attach('file', SVG, { filename: 'logo.svg', contentType: 'image/svg+xml' })
        .expect(422);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('rejects a spoofed extension / MIME type (content is checked, not the name)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/uploads/logos')
        .attach('file', Buffer.from('MZ this is not an image'), { filename: 'logo.png', contentType: 'image/png' })
        .expect(422);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('rejects files over 10 MB', async () => {
      const big = Buffer.concat([PNG_1x1, Buffer.alloc(10 * 1024 * 1024)]);
      const res = await request(app.getHttpServer())
        .post('/api/v1/uploads/logos')
        .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
        .expect(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects a request without a file', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/uploads/logos').field('x', 'y').expect(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for unknown or malformed ids', async () => {
      await request(app.getHttpServer()).get(`/api/v1/uploads/logos/${randomUUID()}`).expect(404);
      const res = await request(app.getHttpServer()).get('/api/v1/uploads/logos/..%2F..%2Fetc%2Fpasswd').expect(404);
      expect(res.body.error.code).toBe('UPLOAD_NOT_FOUND');
    });
  });

  describe('GET /api/v1/catalog/products', () => {
    it('lists active products with tiers and options, filtered by category', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products?category=${categorySlug}`)
        .expect(200);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 24, total: 2 });
      const slugs = res.body.data.map((p: { slug: string }) => p.slug);
      expect(slugs).toEqual(expect.arrayContaining([mugSlug, bannerSlug]));
      expect(slugs).not.toContain(draftSlug);
    });

    it('returns one product in the documented shape', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/catalog/products/${mugSlug}`).expect(200);
      expect(res.body.data).toEqual({
        slug: mugSlug,
        name: 'Tasse e2e',
        description: 'Tasse de test',
        category: { slug: categorySlug, name: 'Catégorie e2e' },
        basePrice: '650.00',
        compareAtPrice: '900.00',
        currency: 'HTG',
        minQty: 12,
        unitLabel: 'pièce',
        colors: ['Blanc'],
        sizes: [],
        placements: ['FRONT', 'WRAP'],
        priceTiers: [
          { minQty: 12, unitPrice: '650.00' },
          { minQty: 50, unitPrice: '575.00' },
          { minQty: 100, unitPrice: '495.00' },
        ],
        images: ['/photos/tasse-11oz.jpg'],
      });
    });

    it('searches with q and 404s on unknown or draft products', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/catalog/products?q=e2e&category=${categorySlug}`).expect(200);
      expect(res.body.data.length).toBe(2);
      const nf = await request(app.getHttpServer()).get(`/api/v1/catalog/products/${draftSlug}`).expect(404);
      expect(nf.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('POST /api/v1/custom-orders', () => {
    it('creates an order, computing tier prices server-side and ignoring client prices', async () => {
      const logoId = await uploadPng();
      const res = await request(app.getHttpServer())
        .post('/api/v1/custom-orders')
        .send({
          ...orderBody([
            { productSlug: mugSlug, quantity: 60, color: 'Blanc', placement: 'WRAP', logoUploadId: logoId, unitPrice: '1.00', lineTotal: '60.00' },
            { productSlug: bannerSlug, quantity: 2, size: '3 × 1,2 m', placement: 'FULL', logoUploadId: logoId, notes: 'Œillets aux 4 coins' },
          ]),
          subtotal: '1.00',
        })
        .expect(201);

      const order = res.body.data;
      expect(order.reference).toMatch(/^IP-\d{4}-\d{6}$/);
      expect(order.status).toBe('RECEIVED');
      expect(order.currency).toBe('HTG');
      // 60 mugs → 50+ tier at 575.00 = 34 500.00; 2 banners at base 8 500.00 = 17 000.00
      expect(order.items).toEqual([
        {
          productSlug: mugSlug,
          productName: 'Tasse e2e',
          quantity: 60,
          unitPrice: '575.00',
          lineTotal: '34500.00',
          placement: 'WRAP',
          color: 'Blanc',
          size: null,
          logoUrl: `/api/v1/uploads/logos/${logoId}`,
        },
        {
          productSlug: bannerSlug,
          productName: 'Banderole e2e',
          quantity: 2,
          unitPrice: '8500.00',
          lineTotal: '17000.00',
          placement: 'FULL',
          color: null,
          size: '3 × 1,2 m',
          logoUrl: `/api/v1/uploads/logos/${logoId}`,
        },
      ]);
      expect(order.subtotal).toBe('51500.00');

      const row = await prisma.customOrder.findUniqueOrThrow({ where: { reference: order.reference } });
      expect(row.email).toBe('client@example.com');
      const audit = await prisma.auditLog.findFirst({ where: { entityType: 'CustomOrder', entityId: row.id } });
      expect(audit?.action).toBe('custom_order.create');
    });

    it('snapshots prices: later catalog changes do not alter existing orders', async () => {
      const logoId = await uploadPng();
      const res = await request(app.getHttpServer())
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: bannerSlug, quantity: 1, placement: 'FULL', logoUploadId: logoId }], 'snap@example.com'))
        .expect(201);
      await prisma.productVariant.update({ where: { sku: `E2E-BAN-${suffix}` }, data: { basePrice: '9999.00' } });
      const tracked = await request(app.getHttpServer())
        .get(`/api/v1/custom-orders/${res.body.data.reference}?email=snap@example.com`)
        .expect(200);
      expect(tracked.body.data.items[0].unitPrice).toBe('8500.00');
      await prisma.productVariant.update({ where: { sku: `E2E-BAN-${suffix}` }, data: { basePrice: '8500.00' } });
    });

    it('rejects quantities below the product minimum', async () => {
      const logoId = await uploadPng();
      const res = await request(app.getHttpServer())
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: mugSlug, quantity: 5, placement: 'FRONT', logoUploadId: logoId }]))
        .expect(422);
      expect(res.body.error.code).toBe('QUANTITY_BELOW_MINIMUM');
      expect(res.body.error.details).toMatchObject({ minQty: 12, quantity: 5 });
    });

    it('rejects unknown and non-active products', async () => {
      const logoId = await uploadPng();
      for (const slug of ['produit-inexistant', draftSlug]) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/custom-orders')
          .send(orderBody([{ productSlug: slug, quantity: 10, placement: 'FRONT', logoUploadId: logoId }]))
          .expect(404);
        expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
      }
    });

    it('rejects a missing or expired logo upload', async () => {
      const missing = await request(app.getHttpServer())
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: bannerSlug, quantity: 1, placement: 'FULL', logoUploadId: randomUUID() }]))
        .expect(422);
      expect(missing.body.error.code).toBe('UPLOAD_NOT_FOUND');

      const old = await prisma.upload.create({
        data: {
          storageKey: `logos/${randomUUID()}`,
          storageDriver: 'local',
          originalName: 'vieux.png',
          mimeType: 'image/png',
          size: 10,
          sha256: '0'.repeat(64),
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      });
      const expired = await request(app.getHttpServer())
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: bannerSlug, quantity: 1, placement: 'FULL', logoUploadId: old.id }]))
        .expect(422);
      expect(expired.body.error.code).toBe('UPLOAD_NOT_FOUND');
    });

    it('returns 422 VALIDATION_ERROR with per-field details for malformed bodies', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/custom-orders')
        .send({
          customer: { fullName: 'M', phone: 'abc', email: 'not-an-email' },
          items: [{ productSlug: mugSlug, quantity: 0, placement: 'TOP', logoUploadId: 'x' }],
          deliveryMethod: 'TELEPORT',
          hacker: true,
        })
        .expect(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = (res.body.error.details as Array<{ field: string }>).map((d) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'customer.fullName',
          'customer.phone',
          'customer.email',
          'items.0.quantity',
          'items.0.placement',
          'items.0.logoUploadId',
          'deliveryMethod',
          'hacker',
        ]),
      );
    });

    it('rejects an empty items list and more than 20 items', async () => {
      await request(app.getHttpServer()).post('/api/v1/custom-orders').send(orderBody([])).expect(422);
      const logoId = randomUUID();
      const many = Array.from({ length: 21 }, () => ({ productSlug: bannerSlug, quantity: 1, placement: 'FULL', logoUploadId: logoId }));
      await request(app.getHttpServer()).post('/api/v1/custom-orders').send(orderBody(many)).expect(422);
    });

    it('generates unique sequential references under concurrency', async () => {
      const logoId = await uploadPng();
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app.getHttpServer())
            .post('/api/v1/custom-orders')
            .send(orderBody([{ productSlug: bannerSlug, quantity: 1, placement: 'FULL', logoUploadId: logoId }], 'para@example.com')),
        ),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      const refs = results.map((r) => r.body.data.reference as string);
      expect(new Set(refs).size).toBe(10);
    });
  });

  describe('GET /api/v1/custom-orders/:reference', () => {
    it('returns the order only when the email matches (case-insensitive)', async () => {
      const logoId = await uploadPng();
      const created = await request(app.getHttpServer())
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: bannerSlug, quantity: 1, placement: 'FULL', logoUploadId: logoId }], 'suivi@example.com'))
        .expect(201);
      const ref = created.body.data.reference;

      const ok = await request(app.getHttpServer()).get(`/api/v1/custom-orders/${ref}?email=SUIVI@example.com`).expect(200);
      expect(ok.body.data).toEqual(created.body.data);

      const wrong = await request(app.getHttpServer()).get(`/api/v1/custom-orders/${ref}?email=autre@example.com`).expect(404);
      const unknown = await request(app.getHttpServer()).get(`/api/v1/custom-orders/IP-2000-999999?email=suivi@example.com`).expect(404);
      // Same response for "wrong email" and "unknown reference" → no enumeration.
      expect(wrong.body.error.code).toBe('ORDER_NOT_FOUND');
      expect(unknown.body.error.code).toBe('ORDER_NOT_FOUND');
      expect(wrong.body.error.message).toBe(unknown.body.error.message);

      await request(app.getHttpServer()).get(`/api/v1/custom-orders/${ref}`).expect(422);
    });
  });

  describe('CORS', () => {
    it('allows the storefront origin on public routes', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/custom-orders')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });
});

describe('Custom order rate limiting (e2e)', () => {
  let app: INestApplication;
  const previous = process.env.ORDER_THROTTLE_LIMIT;

  beforeAll(async () => {
    process.env.ORDER_THROTTLE_LIMIT = '2';
    app = await createApp();
  });

  afterAll(async () => {
    process.env.ORDER_THROTTLE_LIMIT = previous;
    await app.close();
  });

  it('returns 429 after the per-IP order limit is reached', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/v1/custom-orders').send({}).expect(422);
    await request(server).post('/api/v1/custom-orders').send({}).expect(422);
    const res = await request(server).post('/api/v1/custom-orders').send({}).expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
