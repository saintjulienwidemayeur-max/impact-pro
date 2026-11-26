import type { INestApplication } from '@nestjs/common';
import { PricingMode, PrintPlacement, PrismaClient, ProductStatus, UploadPurpose } from '@prisma/client';
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
/** 2×2 JPEG. */
const JPEG_2x2 = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDCooorzj7E/9k=',
  'base64',
);
const PDF_MIN = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
/** Valid PNG signature + padding, just over the 3 MB preview limit. */
const BIG_PNG = Buffer.concat([PNG_1x1, Buffer.alloc(3 * 1024 * 1024 + 1)]);

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

describe('Round 2: product options validation + mock-up previews (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  const categorySlug = `cat-r2-${suffix}`;
  const garmentSlug = `garment-r2-${suffix}`; // color + size both required, custom labels
  const ballSlug = `ball-r2-${suffix}`; // no options at all
  const optionalSlug = `optional-r2-${suffix}`; // optional size
  const bannerSlug = `banner-r2-${suffix}`; // customSize + size presets (not required)
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  async function upload(path: 'logos' | 'artwork' | 'previews', file: Buffer, filename: string, contentType: string): Promise<string> {
    const res = await http().post(`/api/v1/uploads/${path}`).attach('file', file, { filename, contentType }).expect(201);
    return res.body.data.id as string;
  }
  const uploadLogo = () => upload('logos', PNG_1x1, 'logo.png', 'image/png');
  const uploadPreview = () => upload('previews', PNG_1x1, 'preview-front.png', 'image/png');

  const body = (items: unknown[]) => ({
    customer: { fullName: 'Marie Joseph', phone: '+509 3712-3456', email: 'client-r2@example.com' },
    items,
    deliveryMethod: 'PICKUP',
  });
  const reject = async (items: unknown[]): Promise<ApiError> => (await http().post('/api/v1/custom-orders').send(body(items)).expect(422)).body as ApiError;
  const accept = async (items: unknown[]) => (await http().post('/api/v1/custom-orders').send(body(items)).expect(201)).body.data;

  const front = (uploadId: string) => ({ placement: 'FRONT', kind: 'LOGO', uploadId });

  async function makeProduct(slug: string, data: Record<string, unknown>, price = '500.00') {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: categorySlug } });
    const product = await prisma.product.create({
      data: { slug, name: `Produit ${slug}`, categoryId: category.id, status: ProductStatus.ACTIVE, minOrderQty: 1, ...data } as never,
    });
    await prisma.productVariant.create({ data: { productId: product.id, sku: `SKU-${slug}`, name: 'Standard', basePrice: price } });
  }

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.category.create({ data: { name: 'Catégorie r2', slug: categorySlug } });
    await makeProduct(garmentSlug, {
      colorLabel: 'Couleur du toit',
      colors: ['Blanc', 'Bleu royal'],
      colorsRequired: true,
      sizeLabel: 'Dimensions',
      sizes: ['3 × 3 m', '3 × 6 m'],
      sizesRequired: true,
      placements: [PrintPlacement.FRONT, PrintPlacement.BACK],
    });
    await makeProduct(ballSlug, { placements: [PrintPlacement.FRONT, PrintPlacement.BACK] });
    await makeProduct(optionalSlug, { sizes: ['A5', 'A4'], sizeLabel: 'Format', placements: [PrintPlacement.FRONT] });
    await makeProduct(
      bannerSlug,
      {
        placements: [PrintPlacement.FULL],
        pricingMode: PricingMode.PER_AREA,
        supportsArtwork: true,
        artworkRequired: true,
        sizeLabel: 'Format rapide',
        sizes: ['2 × 1 m', '3 × 1,2 m'],
        sizesRequired: false,
        customSize: { minWidthCm: 50, maxWidthCm: 1000, minHeightCm: 50, maxHeightCm: 500, defaultWidthCm: 300, defaultHeightCm: 120, minBillableM2: 1 },
      },
      '2800.00',
    );
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('catalog exposes option labels and flags', () => {
    it('returns colorLabel / sizeLabel / colorsRequired / sizesRequired per product', async () => {
      const g = (await http().get(`/api/v1/catalog/products/${garmentSlug}`).expect(200)).body.data;
      expect(g).toMatchObject({ colorLabel: 'Couleur du toit', colorsRequired: true, sizeLabel: 'Dimensions', sizesRequired: true, colors: ['Blanc', 'Bleu royal'] });
      const b = (await http().get(`/api/v1/catalog/products/${ballSlug}`).expect(200)).body.data;
      expect(b).toMatchObject({ colors: [], sizes: [], colorsRequired: false, sizesRequired: false, colorLabel: 'Couleur', sizeLabel: 'Taille' });
    });
  });

  describe('options validation matrix', () => {
    it('COLOR_REQUIRED when a required color is missing', async () => {
      const logo = await uploadLogo();
      const e = await reject([{ productSlug: garmentSlug, quantity: 1, size: '3 × 3 m', elements: [front(logo)] }]);
      expect(e.error.code).toBe('COLOR_REQUIRED');
      expect(e.error.details).toMatchObject({ index: 0, field: 'color', label: 'Couleur du toit', allowed: ['Blanc', 'Bleu royal'] });
    });

    it('SIZE_REQUIRED when a required size is missing', async () => {
      const logo = await uploadLogo();
      const e = await reject([{ productSlug: garmentSlug, quantity: 1, color: 'Blanc', elements: [front(logo)] }]);
      expect(e.error.code).toBe('SIZE_REQUIRED');
      expect(e.error.details).toMatchObject({ field: 'size', label: 'Dimensions' });
    });

    it('INVALID_OPTION for a color or size outside the product lists', async () => {
      const logo = await uploadLogo();
      const badColor = await reject([{ productSlug: garmentSlug, quantity: 1, color: 'Rouge', size: '3 × 3 m', elements: [front(logo)] }]);
      expect(badColor.error.code).toBe('INVALID_OPTION');
      expect(badColor.error.details).toMatchObject({ field: 'color', value: 'Rouge' });
      const badSize = await reject([{ productSlug: garmentSlug, quantity: 1, color: 'Blanc', size: '9 × 9 m', elements: [front(logo)] }]);
      expect(badSize.error.code).toBe('INVALID_OPTION');
      expect(badSize.error.details).toMatchObject({ field: 'size', value: '9 × 9 m' });
    });

    it('matches options ignoring case/accents/spaces and stores the product spelling', async () => {
      const logo = await uploadLogo();
      const order = await accept([{ productSlug: garmentSlug, quantity: 2, color: '  bleu ROYAL ', size: '3 × 6 m', elements: [front(logo)] }]);
      expect(order.items[0]).toMatchObject({ color: 'Bleu royal', size: '3 × 6 m' });
    });

    it('a product with no options needs none — and refuses an option it does not have (no size for a ball)', async () => {
      const logo = await uploadLogo();
      const ok = await accept([{ productSlug: ballSlug, quantity: 3, elements: [front(logo)] }]);
      expect(ok.items[0]).toMatchObject({ color: null, size: null });
      const withSize = await reject([{ productSlug: ballSlug, quantity: 3, size: 'M', elements: [front(logo)] }]);
      expect(withSize.error.code).toBe('INVALID_OPTION');
      expect(withSize.error.details).toMatchObject({ field: 'size', allowed: [] });
      const withColor = await reject([{ productSlug: ballSlug, quantity: 3, color: 'Rouge', elements: [front(logo)] }]);
      expect(withColor.error.code).toBe('INVALID_OPTION');
    });

    it('an optional size may be omitted but must be valid when given', async () => {
      const logo = await uploadLogo();
      await accept([{ productSlug: optionalSlug, quantity: 1, elements: [front(logo)] }]);
      const e = await reject([{ productSlug: optionalSlug, quantity: 1, size: 'A3', elements: [front(logo)] }]);
      expect(e.error.code).toBe('INVALID_OPTION');
    });

    it('custom-size products do not require the preset size (width × height is the choice)', async () => {
      const art = await upload('artwork', PNG_1x1, 'visuel.png', 'image/png');
      const order = await accept([
        { productSlug: bannerSlug, quantity: 1, widthCm: 300, heightCm: 120, elements: [{ placement: 'FULL', kind: 'ARTWORK', uploadId: art }] },
      ]);
      expect(order.items[0]).toMatchObject({ size: null, areaM2: 3.6 });
    });

    it('the legacy single-logo shorthand is validated too', async () => {
      const logo = await uploadLogo();
      const e = await reject([{ productSlug: garmentSlug, quantity: 1, placement: 'FRONT', logoUploadId: logo }]);
      expect(e.error.code).toBe('COLOR_REQUIRED');
    });
  });

  describe('POST /api/v1/uploads/previews', () => {
    it('accepts a PNG and serves it back with safe headers', async () => {
      const res = await http().post('/api/v1/uploads/previews').attach('file', PNG_1x1, { filename: 'preview-front.png', contentType: 'image/png' }).expect(201);
      expect(res.body.data).toMatchObject({ mimeType: 'image/png', originalName: 'preview-front.png', width: 1, height: 1 });
      expect(res.body.data.url).toBe(`/api/v1/uploads/previews/${res.body.data.id}`);
      const dl = await http().get(res.body.data.url).expect(200);
      expect(dl.headers['content-type']).toBe('image/png');
      expect(dl.headers['x-content-type-options']).toBe('nosniff');
      expect(dl.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(Buffer.compare(dl.body as Buffer, PNG_1x1)).toBe(0);
      const row = await prisma.upload.findUniqueOrThrow({ where: { id: res.body.data.id } });
      expect(row.purpose).toBe(UploadPurpose.PREVIEW);
    });

    it('accepts a JPEG', async () => {
      const res = await http().post('/api/v1/uploads/previews').attach('file', JPEG_2x2, { filename: 'p.jpg', contentType: 'image/jpeg' }).expect(201);
      expect(res.body.data).toMatchObject({ mimeType: 'image/jpeg', width: 2, height: 2 });
    });

    it('rejects SVG, PDF and WEBP-style types (previews are PNG/JPEG only)', async () => {
      for (const [file, name, type] of [
        [SVG, 'p.svg', 'image/svg+xml'],
        [PDF_MIN, 'p.pdf', 'application/pdf'],
        [Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]), 'p.webp', 'image/webp'],
      ] as const) {
        const res = await http().post('/api/v1/uploads/previews').attach('file', file, { filename: name, contentType: type }).expect(422);
        expect((res.body as ApiError).error.code).toBe('UNSUPPORTED_FILE_TYPE');
      }
    });

    it('rejects a spoofed file (text declared as image/png) and an empty request', async () => {
      const spoof = await http().post('/api/v1/uploads/previews').attach('file', Buffer.from('not an image at all'), { filename: 'p.png', contentType: 'image/png' }).expect(422);
      expect((spoof.body as ApiError).error.code).toBe('UNSUPPORTED_FILE_TYPE');
      await http().post('/api/v1/uploads/previews').expect(422);
    });

    it('rejects a file over the 3 MB limit', async () => {
      const res = await http().post('/api/v1/uploads/previews').attach('file', BIG_PNG, { filename: 'big.png', contentType: 'image/png' }).expect(413);
      expect((res.body as ApiError).error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('returns 404 for an unknown id', async () => {
      await http().get(`/api/v1/uploads/previews/${randomUUID()}`).expect(404);
    });
  });

  describe('orders with mock-up previews', () => {
    it('stores one preview per zone, returns them on creation and on tracking', async () => {
      const logo = await uploadLogo();
      const p1 = await uploadPreview();
      const p2 = await uploadPreview();
      const order = await accept([
        {
          productSlug: garmentSlug,
          quantity: 2,
          color: 'Blanc',
          size: '3 × 3 m',
          elements: [front(logo), { placement: 'BACK', kind: 'TEXT', text: 'Maman Chérie' }],
          previews: [
            { placement: 'FRONT', uploadId: p1 },
            { placement: 'BACK', uploadId: p2 },
          ],
        },
      ]);
      expect(order.items[0].previews).toEqual(
        expect.arrayContaining([
          { placement: 'FRONT', url: `/api/v1/uploads/previews/${p1}` },
          { placement: 'BACK', url: `/api/v1/uploads/previews/${p2}` },
        ]),
      );
      expect(order.items[0].previews).toHaveLength(2);

      const tracked = (await http().get(`/api/v1/custom-orders/${order.reference}`).query({ email: 'client-r2@example.com' }).expect(200)).body.data;
      expect(tracked.items[0].previews).toHaveLength(2);
      expect(tracked.items[0].elements).toHaveLength(2);

      const rows = await prisma.customOrderItemPreview.findMany({ where: { item: { order: { reference: order.reference } } } });
      expect(rows.map((r) => r.placement).sort()).toEqual(['BACK', 'FRONT']);
    });

    it('items without previews return an empty list (previews are optional)', async () => {
      const logo = await uploadLogo();
      const order = await accept([{ productSlug: ballSlug, quantity: 1, elements: [front(logo)] }]);
      expect(order.items[0].previews).toEqual([]);
    });

    it('rejects a preview for a zone the product does not have', async () => {
      const logo = await uploadLogo();
      const p = await uploadPreview();
      const e = await reject([{ productSlug: optionalSlug, quantity: 1, elements: [front(logo)], previews: [{ placement: 'BACK', uploadId: p }] }]);
      expect(e.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(e.error.details)).toContain('items.0.previews.0.placement');
    });

    it('rejects two previews for the same zone', async () => {
      const logo = await uploadLogo();
      const [a, b] = [await uploadPreview(), await uploadPreview()];
      const e = await reject([
        { productSlug: ballSlug, quantity: 1, elements: [front(logo)], previews: [{ placement: 'FRONT', uploadId: a }, { placement: 'FRONT', uploadId: b }] },
      ]);
      expect(e.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(e.error.details)).toContain('only one preview per zone');
    });

    it('UPLOAD_NOT_FOUND for an unknown preview id or an upload that is not a preview', async () => {
      const logo = await uploadLogo();
      const unknown = await reject([{ productSlug: ballSlug, quantity: 1, elements: [front(logo)], previews: [{ placement: 'FRONT', uploadId: randomUUID() }] }]);
      expect(unknown.error.code).toBe('UPLOAD_NOT_FOUND');
      expect(unknown.error.details).toMatchObject({ index: 0, previewIndex: 0 });
      const notPreview = await reject([{ productSlug: ballSlug, quantity: 1, elements: [front(logo)], previews: [{ placement: 'FRONT', uploadId: logo }] }]);
      expect(notPreview.error.code).toBe('UPLOAD_NOT_FOUND');
    });

    it('a preview upload cannot be used as a logo element', async () => {
      const p = await uploadPreview();
      const e = await reject([{ productSlug: ballSlug, quantity: 1, elements: [front(p)] }]);
      expect(e.error.code).toBe('UPLOAD_NOT_FOUND');
    });

    it('rejects more than 12 previews on one item', async () => {
      const logo = await uploadLogo();
      const p = await uploadPreview();
      const previews = Array.from({ length: 13 }, () => ({ placement: 'FRONT', uploadId: p }));
      const e = await reject([{ productSlug: ballSlug, quantity: 1, elements: [front(logo)], previews }]);
      expect(e.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
