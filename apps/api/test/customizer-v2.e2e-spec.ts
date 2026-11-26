import type { INestApplication } from '@nestjs/common';
import { PricingMode, PrintPlacement, PrismaClient, ProductStatus } from '@prisma/client';
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

interface ApiError {
  error: { code: string; details?: unknown };
}

describe('Customizer v2: artwork uploads, design elements, area pricing (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  const teeSlug = `tee-v2-${suffix}`;
  const bannerSlug = `banner-v2-${suffix}`;
  const noTextSlug = `notext-v2-${suffix}`;
  const categorySlug = `cat-v2-${suffix}`;
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  async function uploadLogo(): Promise<string> {
    const res = await http().post('/api/v1/uploads/logos').attach('file', PNG_1x1, { filename: 'logo.png', contentType: 'image/png' }).expect(201);
    return res.body.data.id as string;
  }

  async function uploadArtwork(file: Buffer = PNG_1x1, filename = 'visuel.png', contentType = 'image/png'): Promise<{ id: string; url: string }> {
    const res = await http().post('/api/v1/uploads/artwork').attach('file', file, { filename, contentType }).expect(201);
    return res.body.data as { id: string; url: string };
  }

  function orderBody(items: unknown[]) {
    return {
      customer: { fullName: 'Marie Joseph', phone: '+509 3712-3456', email: 'client-v2@example.com' },
      items,
      deliveryMethod: 'PICKUP',
    };
  }

  /** POST an order expecting a 422 and return the error body. */
  async function reject(items: unknown[]): Promise<ApiError> {
    const res = await http().post('/api/v1/custom-orders').send(orderBody(items)).expect(422);
    return res.body as ApiError;
  }

  const logoEl = (uploadId: string, placement = 'FRONT') => ({ placement, kind: 'LOGO', uploadId });
  const textEl = (text: string, extra: Record<string, unknown> = {}) => ({ placement: 'BACK', kind: 'TEXT', text, ...extra });

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.create({ data: { name: 'Catégorie v2', slug: categorySlug } });

    const tee = await prisma.product.create({
      data: {
        slug: teeSlug,
        name: 'T-shirt v2',
        categoryId: category.id,
        status: ProductStatus.ACTIVE,
        minOrderQty: 1,
        colors: ['Blanc'],
        sizes: ['M', 'L'],
        placements: [PrintPlacement.FRONT, PrintPlacement.BACK, PrintPlacement.CHEST_LEFT],
      },
    });
    await prisma.productVariant.create({
      data: { productId: tee.id, sku: `V2-TEE-${suffix}`, name: 'Standard', basePrice: '750.00', priceTiers: { create: [{ minQty: 12, unitPrice: '650.00' }] } },
    });

    const banner = await prisma.product.create({
      data: {
        slug: bannerSlug,
        name: 'Banderole v2',
        categoryId: category.id,
        status: ProductStatus.ACTIVE,
        minOrderQty: 1,
        unitLabel: 'banderole',
        placements: [PrintPlacement.FRONT],
        pricingMode: PricingMode.PER_AREA,
        supportsArtwork: true,
        artworkRequired: true,
        customSize: {
          minWidthCm: 50,
          maxWidthCm: 1000,
          minHeightCm: 50,
          maxHeightCm: 500,
          defaultWidthCm: 300,
          defaultHeightCm: 120,
          minBillableM2: 1,
        },
      },
    });
    await prisma.productVariant.create({
      data: {
        productId: banner.id,
        sku: `V2-BAN-${suffix}`,
        name: 'Standard',
        basePrice: '2800.00', // HTG per m²
        priceTiers: { create: [{ minQty: 1, unitPrice: '2800.00' }, { minQty: 5, unitPrice: '2500.00' }] },
      },
    });

    const noText = await prisma.product.create({
      data: {
        slug: noTextSlug,
        name: 'Sans texte v2',
        categoryId: category.id,
        status: ProductStatus.ACTIVE,
        minOrderQty: 1,
        placements: [PrintPlacement.FRONT],
        supportsText: false,
      },
    });
    await prisma.productVariant.create({ data: { productId: noText.id, sku: `V2-NOTEXT-${suffix}`, name: 'Standard', basePrice: '100.00' } });
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/uploads/artwork', () => {
    it('accepts a PNG and a PDF, serves them from the artwork URL and records dimensions', async () => {
      const png = await uploadArtwork();
      expect(png.url).toBe(`/api/v1/uploads/artwork/${png.id}`);
      const meta = (await http().post('/api/v1/uploads/artwork').attach('file', PNG_1x1, { filename: 'a.png', contentType: 'image/png' }).expect(201)).body.data;
      expect(meta).toMatchObject({ mimeType: 'image/png', width: 1, height: 1, originalName: 'a.png' });

      const file = await http().get(png.url).buffer(true).expect(200);
      expect(file.headers['content-type']).toMatch(/image\/png/);
      expect(file.headers['x-content-type-options']).toBe('nosniff');
      expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');

      const pdf = await uploadArtwork(PDF_MIN, 'visuel.pdf', 'application/pdf');
      const dl = await http().get(pdf.url).expect(200);
      expect(dl.headers['content-disposition']).toMatch(/^attachment/);
      const row = await prisma.upload.findUniqueOrThrow({ where: { id: pdf.id } });
      expect(row.purpose).toBe('ARTWORK');
      expect(row.storageKey).toBe(`artwork/${pdf.id}`);
    });

    it('rejects SVG, spoofed content, missing files and files over the artwork limit', async () => {
      const svg = await http().post('/api/v1/uploads/artwork').attach('file', SVG, { filename: 'v.svg', contentType: 'image/svg+xml' }).expect(422);
      expect(svg.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
      const spoof = await http()
        .post('/api/v1/uploads/artwork')
        .attach('file', Buffer.from('MZ not an image'), { filename: 'v.png', contentType: 'image/png' })
        .expect(422);
      expect(spoof.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
      await http().post('/api/v1/uploads/artwork').expect(422);
      // default artwork limit is 25 MB (logos stay at 10 MB)
      const big = Buffer.concat([PNG_1x1, Buffer.alloc(26 * 1024 * 1024)]);
      const res = await http().post('/api/v1/uploads/artwork').attach('file', big, { filename: 'big.png', contentType: 'image/png' }).expect(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('accepts a file between 10 MB and 25 MB as artwork but not as a logo', async () => {
      const mid = Buffer.concat([PNG_1x1, Buffer.alloc(12 * 1024 * 1024)]);
      // Trailing bytes after the PNG are ignored by the type sniffer; image-size only reads the header.
      await http().post('/api/v1/uploads/artwork').attach('file', mid, { filename: 'mid.png', contentType: 'image/png' }).expect(201);
      await http().post('/api/v1/uploads/logos').attach('file', mid, { filename: 'mid.png', contentType: 'image/png' }).expect(413);
    });

    it('logo uploads also return width/height and keep the /logos URL', async () => {
      const res = await http().post('/api/v1/uploads/logos').attach('file', PNG_1x1, { filename: 'l.png', contentType: 'image/png' }).expect(201);
      expect(res.body.data.url).toBe(`/api/v1/uploads/logos/${res.body.data.id}`);
      expect(res.body.data).toMatchObject({ width: 1, height: 1 });
    });
  });

  describe('GET /api/v1/catalog/products/:slug', () => {
    it('exposes pricing mode, capabilities, custom size and zones', async () => {
      const res = await http().get(`/api/v1/catalog/products/${bannerSlug}`).expect(200);
      expect(res.body.data).toMatchObject({
        pricingMode: 'PER_AREA',
        supportsLogo: true,
        supportsText: true,
        supportsArtwork: true,
        artworkRequired: true,
        placements: ['FRONT'],
        zones: [{ placement: 'FRONT', label: 'Devant', maxElements: 10 }],
        customSize: { minWidthCm: 50, maxWidthCm: 1000, minHeightCm: 50, maxHeightCm: 500, defaultWidthCm: 300, defaultHeightCm: 120, minBillableM2: 1 },
        basePrice: '2800.00',
      });
      const tee = await http().get(`/api/v1/catalog/products/${teeSlug}`).expect(200);
      expect(tee.body.data.customSize).toBeNull();
      expect(tee.body.data.zones.map((z: { placement: string; label: string }) => `${z.placement}:${z.label}`)).toEqual([
        'FRONT:Devant',
        'BACK:Dos',
        'CHEST_LEFT:Cœur (poitrine gauche)',
      ]);
    });
  });

  describe('POST /api/v1/custom-orders (design elements)', () => {
    it('creates a multi-zone order: logo front, text back, extra logo, and an artwork banner; tracking returns the same design', async () => {
      const logoA = await uploadLogo();
      const logoB = await uploadLogo();
      const art = await uploadArtwork();
      const res = await http()
        .post('/api/v1/custom-orders')
        .send(
          orderBody([
            {
              productSlug: teeSlug,
              quantity: 12,
              color: 'Blanc',
              size: 'L',
              elements: [
                { ...logoEl(logoA, 'FRONT'), x: -0.1, y: 0.05, scale: 0.8, rotation: 15 },
                textEl('Équipe Soleil\r\n2026', { font: 'pacifico', fontWeight: 'bold', color: '#0a716a', align: 'left', x: 0, y: -0.2, scale: 1.5 }),
                { ...logoEl(logoB, 'CHEST_LEFT'), scale: 0.3 },
              ],
            },
            { productSlug: bannerSlug, quantity: 2, widthCm: 300, heightCm: 120, elements: [{ placement: 'FRONT', kind: 'ARTWORK', uploadId: art.id }] },
          ]),
        )
        .expect(201);
      const order = res.body.data;
      const [tee, banner] = order.items;

      // 12 tees at the 12+ tier (650.00); banner 3 m × 1.2 m = 3.6 m² × 2800 = 10 080.00 each × 2
      expect(tee.unitPrice).toBe('650.00');
      expect(tee.lineTotal).toBe('7800.00');
      expect(banner).toMatchObject({ unitPrice: '10080.00', lineTotal: '20160.00', widthCm: 300, heightCm: 120, areaM2: 3.6 });
      expect(order.subtotal).toBe('27960.00');

      expect(tee.elements).toHaveLength(3);
      expect(tee.elements[0]).toEqual({
        placement: 'FRONT',
        kind: 'LOGO',
        x: -0.1,
        y: 0.05,
        scale: 0.8,
        rotation: 15,
        sort: 0,
        logoUrl: `/api/v1/uploads/logos/${logoA}`,
        originalName: 'logo.png',
      });
      expect(tee.elements[1]).toEqual({
        placement: 'BACK',
        kind: 'TEXT',
        text: 'Équipe Soleil\n2026',
        font: 'pacifico',
        fontWeight: 'bold',
        color: '#0A716A',
        align: 'left',
        x: 0,
        y: -0.2,
        scale: 1.5,
        rotation: 0,
        sort: 1,
      });
      expect(tee.elements[2]).toMatchObject({ placement: 'CHEST_LEFT', kind: 'LOGO', sort: 2, scale: 0.3 });
      // legacy fields mirror the first element
      expect(tee).toMatchObject({ placement: 'FRONT', logoUrl: `/api/v1/uploads/logos/${logoA}` });
      expect(banner.elements).toEqual([
        { placement: 'FRONT', kind: 'ARTWORK', x: 0, y: 0, scale: 1, rotation: 0, sort: 0, logoUrl: art.url, originalName: 'visuel.png' },
      ]);

      const tracked = await http().get(`/api/v1/custom-orders/${order.reference}?email=CLIENT-V2@example.com`).expect(200);
      expect(tracked.body.data.items).toEqual(order.items);

      const item = await prisma.customOrderItem.findFirstOrThrow({
        where: { order: { reference: order.reference }, productSlug: bannerSlug },
        include: { elements: true },
      });
      expect(item.areaM2?.toNumber()).toBe(3.6);
      expect(item.elements).toHaveLength(1);
      const audit = await prisma.auditLog.findFirst({ where: { entityType: 'CustomOrder', action: 'custom_order.create' }, orderBy: { createdAt: 'desc' } });
      expect(audit?.metadata).toMatchObject({ reference: order.reference, itemCount: 2, elementCount: 4 });
    });

    it('applies defaults to omitted element fields and strips control characters from text', async () => {
      const res = await http()
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: teeSlug, quantity: 1, elements: [textEl('  Bonjour\u0000\u0007 !  ')] }]))
        .expect(201);
      expect(res.body.data.items[0].elements[0]).toEqual({
        placement: 'BACK',
        kind: 'TEXT',
        text: 'Bonjour !',
        font: 'inter',
        fontWeight: 'regular',
        color: '#000000',
        align: 'center',
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        sort: 0,
      });
      expect(res.body.data.items[0].logoUrl).toBeNull();
    });

    it('honours the layer order given in `sort`', async () => {
      const res = await http()
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: teeSlug, quantity: 1, elements: [{ ...textEl('dessus'), sort: 5 }, { ...textEl('dessous'), sort: 1 }] }]))
        .expect(201);
      expect(res.body.data.items[0].elements.map((e: { text: string; sort: number }) => [e.text, e.sort])).toEqual([
        ['dessous', 0],
        ['dessus', 1],
      ]);
    });

    it('still accepts the legacy placement + logoUploadId shorthand as one centered LOGO element', async () => {
      const logo = await uploadLogo();
      const res = await http()
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: teeSlug, quantity: 1, placement: 'CHEST_LEFT', logoUploadId: logo }]))
        .expect(201);
      expect(res.body.data.items[0]).toMatchObject({
        placement: 'CHEST_LEFT',
        logoUrl: `/api/v1/uploads/logos/${logo}`,
        elements: [{ placement: 'CHEST_LEFT', kind: 'LOGO', x: 0, y: 0, scale: 1, rotation: 0, sort: 0 }],
      });
    });
  });

  describe('area pricing (PER_AREA)', () => {
    async function bannerPrice(quantity: number, widthCm: number, heightCm: number) {
      const art = await uploadArtwork();
      const res = await http()
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: bannerSlug, quantity, widthCm, heightCm, elements: [{ placement: 'FRONT', kind: 'ARTWORK', uploadId: art.id }] }]))
        .expect(201);
      return res.body.data.items[0] as { unitPrice: string; lineTotal: string; areaM2: number };
    }

    it('picks the per-m² tier from the quantity', async () => {
      // 5+ → 2500/m²; 3 m × 1.2 m = 3.6 m² → 9000.00 each × 5
      expect(await bannerPrice(5, 300, 120)).toMatchObject({ unitPrice: '9000.00', lineTotal: '45000.00', areaM2: 3.6 });
      // 1–4 → 2800/m²
      expect(await bannerPrice(4, 300, 120)).toMatchObject({ unitPrice: '10080.00', lineTotal: '40320.00' });
    });

    it('bills at least minBillableM2', async () => {
      // 50 × 50 cm = 0.25 m² < 1 m² minimum → billed 1 m²
      expect(await bannerPrice(1, 50, 50)).toMatchObject({ unitPrice: '2800.00', lineTotal: '2800.00', areaM2: 1 });
    });

    it('prices from the stored 4-decimal area and rounds the unit price to 2 decimals', async () => {
      // 200.5 × 133.3 cm = 2.672665 m² → stored/billed as 2.6727 m² × 2800 = 7483.56
      expect(await bannerPrice(1, 200.5, 133.3)).toMatchObject({ unitPrice: '7483.56', lineTotal: '7483.56', areaM2: 2.6727 });
    });
  });

  describe('validation matrix', () => {
    it('rejects an element kind the product does not support', async () => {
      const art = await uploadArtwork();
      const noArtwork = await reject([{ productSlug: teeSlug, quantity: 1, elements: [{ placement: 'FRONT', kind: 'ARTWORK', uploadId: art.id }] }]);
      expect(noArtwork.error.code).toBe('ELEMENT_NOT_SUPPORTED');
      const noText = await reject([{ productSlug: noTextSlug, quantity: 1, elements: [textEl('Salut', { placement: 'FRONT' })] }]);
      expect(noText.error.code).toBe('ELEMENT_NOT_SUPPORTED');
      expect(noText.error.details).toMatchObject({ index: 0, elementIndex: 0, kind: 'TEXT' });
    });

    it('rejects a zone that is not one of the product placements', async () => {
      const res = await reject([{ productSlug: teeSlug, quantity: 1, elements: [textEl('Côté', { placement: 'SIDE' })] }]);
      expect(res.error.code).toBe('ELEMENT_NOT_SUPPORTED');
      expect(res.error.details).toMatchObject({ placement: 'SIDE' });
    });

    it('validates TEXT / LOGO element fields with per-field details', async () => {
      const res = await reject([
        {
          productSlug: teeSlug,
          quantity: 1,
          elements: [
            { placement: 'BACK', kind: 'TEXT' }, // missing text
            textEl('ok', { font: 'comic-sans' }),
            textEl('ok', { color: 'red' }),
            textEl('ok', { align: 'justify' }),
            textEl('ok', { scale: 9 }),
            textEl('ok', { x: 3 }),
            textEl('ok', { rotation: 400 }),
            textEl('1\n2\n3\n4\n5\n6\n7'), // 7 lines
            textEl('x'.repeat(201)),
            { placement: 'FRONT', kind: 'LOGO' }, // missing upload
            { placement: 'FRONT', kind: 'LOGO', uploadId: 'not-a-uuid' },
            { placement: 'NOWHERE', kind: 'LOGO', uploadId: randomUUID() },
            { placement: 'FRONT', kind: 'SPRAY', uploadId: randomUUID() },
          ],
        },
      ]);
      expect(res.error.code).toBe('VALIDATION_ERROR');
      const fields = (res.error.details as Array<{ field: string }>).map((d) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'items.0.elements.0.text',
          'items.0.elements.1.font',
          'items.0.elements.2.color',
          'items.0.elements.3.align',
          'items.0.elements.4.scale',
          'items.0.elements.5.x',
          'items.0.elements.6.rotation',
          'items.0.elements.7.text',
          'items.0.elements.8.text',
          'items.0.elements.9.uploadId',
          'items.0.elements.10.uploadId',
          'items.0.elements.11.placement',
          'items.0.elements.12.kind',
        ]),
      );
    });

    it('requires at least one element (or the legacy shorthand) and caps the list at 30', async () => {
      const none = await reject([{ productSlug: teeSlug, quantity: 1 }]);
      expect(none.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(none.error.details)).toContain('items.0.elements');
      await reject([{ productSlug: teeSlug, quantity: 1, elements: [] }]);
      await reject([{ productSlug: teeSlug, quantity: 1, elements: Array.from({ length: 31 }, () => textEl('x')) }]);
    });

    it('limits the number of elements per zone', async () => {
      const res = await reject([{ productSlug: teeSlug, quantity: 1, elements: Array.from({ length: 11 }, (_, i) => textEl(`t${i}`)) }]);
      expect(res.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.error.details)).toMatch(/at most 10 elements/);
    });

    it('requires the ready-to-print file for artwork-only products', async () => {
      const textOnly = await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 300, heightCm: 120, elements: [textEl('Promo', { placement: 'FRONT' })] }]);
      expect(textOnly.error.code).toBe('ARTWORK_REQUIRED');
      const logo = await uploadLogo();
      const legacy = await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 300, heightCm: 120, placement: 'FRONT', logoUploadId: logo }]);
      expect(legacy.error.code).toBe('ARTWORK_REQUIRED');
      const bare = await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 300, heightCm: 120 }]);
      expect(bare.error.code).toBe('ARTWORK_REQUIRED');
    });

    it('checks the custom size', async () => {
      const art = await uploadArtwork();
      const el = [{ placement: 'FRONT', kind: 'ARTWORK', uploadId: art.id }];
      const tooWide = await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 1200, heightCm: 100, elements: el }]);
      expect(tooWide.error.code).toBe('SIZE_OUT_OF_RANGE');
      expect(tooWide.error.details).toMatchObject({ widthCm: 1200, maxWidthCm: 1000 });
      expect((await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 300, heightCm: 10, elements: el }])).error.code).toBe('SIZE_OUT_OF_RANGE');
      const missing = await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 300, elements: el }]);
      expect(missing.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(missing.error.details)).toContain('items.0.heightCm');
      // absurd values are caught by the DTO before the product range
      expect((await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 99999, heightCm: 100, elements: el }])).error.code).toBe('VALIDATION_ERROR');
    });

    it('ignores width/height for products without a custom size', async () => {
      const res = await http()
        .post('/api/v1/custom-orders')
        .send(orderBody([{ productSlug: teeSlug, quantity: 1, widthCm: 500, heightCm: 500, elements: [textEl('ok')] }]))
        .expect(201);
      expect(res.body.data.items[0]).not.toHaveProperty('widthCm');
      expect(res.body.data.items[0]).not.toHaveProperty('areaM2');
    });

    it('rejects unknown and expired uploads, naming the offending element', async () => {
      const logo = await uploadLogo();
      const missing = await reject([{ productSlug: teeSlug, quantity: 1, elements: [logoEl(logo), logoEl(randomUUID(), 'BACK')] }]);
      expect(missing.error.code).toBe('UPLOAD_NOT_FOUND');
      expect(missing.error.details).toMatchObject({ index: 0, elementIndex: 1 });

      const old = await prisma.upload.create({
        data: {
          storageKey: `artwork/${randomUUID()}`,
          storageDriver: 'local',
          originalName: 'vieux.png',
          mimeType: 'image/png',
          size: 10,
          sha256: '0'.repeat(64),
          purpose: 'ARTWORK',
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      });
      const expired = await reject([{ productSlug: bannerSlug, quantity: 1, widthCm: 300, heightCm: 120, elements: [{ placement: 'FRONT', kind: 'ARTWORK', uploadId: old.id }] }]);
      expect(expired.error.code).toBe('UPLOAD_NOT_FOUND');
    });

    it('does not create anything when one item of the order is invalid (transactional)', async () => {
      const before = await prisma.customOrderItem.count({ where: { productSlug: teeSlug } });
      const logo = await uploadLogo();
      await reject([
        { productSlug: teeSlug, quantity: 1, elements: [logoEl(logo)] },
        { productSlug: teeSlug, quantity: 1, elements: [textEl('x', { placement: 'SIDE' })] },
      ]);
      expect(await prisma.customOrderItem.count({ where: { productSlug: teeSlug } })).toBe(before);
    });
  });

  describe('references under concurrency', () => {
    it('still generates unique references for parallel multi-element orders', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          http()
            .post('/api/v1/custom-orders')
            .send(orderBody([{ productSlug: teeSlug, quantity: 1, elements: [textEl(`n${i}`), textEl('dos', { placement: 'BACK', y: 0.2 })] }]))
            .expect(201),
        ),
      );
      const refs = results.map((r) => r.body.data.reference as string);
      expect(new Set(refs).size).toBe(10);
    });
  });
});
