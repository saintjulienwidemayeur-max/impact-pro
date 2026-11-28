import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, StaffRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { setupApp } from '../src/setup-app';

const STRONG = 'Cafe-Pwa-Nwa-2026!';

type Cookies = { header: string; csrf: string };
function jar(setCookie: string[] | undefined): Cookies {
  const pairs = (setCookie ?? []).map((c) => c.split(';')[0]);
  const csrf = pairs.find((p) => p.startsWith('ip_csrf='))?.slice('ip_csrf='.length) ?? '';
  return { header: pairs.join('; '), csrf };
}

describe('Quote requests (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  let app: INestApplication;
  let passwords: PasswordService;
  let n = 0;
  const server = () => app.getHttpServer();
  const email = (tag: string) => `${tag}-${suffix}-${n++}@example.com`;

  async function staff(role: StaffRole): Promise<Cookies> {
    const addr = email(role.toLowerCase());
    await prisma.user.create({ data: { email: addr, fullName: `Staff ${role}`, isStaff: true, staffRole: role, passwordHash: await passwords.hash(STRONG) } });
    const res = await request(server()).post('/api/v1/auth/login').send({ email: addr, password: STRONG });
    return jar(res.headers['set-cookie'] as unknown as string[]);
  }
  const get = (path: string, c: Cookies) => request(server()).get(`/api/v1${path}`).set('Cookie', c.header);
  const patch = (path: string, c: Cookies, body: object) => request(server()).patch(`/api/v1${path}`).set('Cookie', c.header).set('x-csrf-token', c.csrf).send(body);

  const valid = (over: Record<string, unknown> = {}) => ({
    service: 'evenement',
    size: 'grand',
    name: 'Marie Joseph',
    company: 'Kanaval SA',
    phone: '+509 3712-3456',
    email: email('client'),
    products: '2 000 bandanas et 500 t-shirts pour le carnaval',
    quantity: '2500',
    message: 'Livraison à Jacmel',
    ...over,
  });

  beforeAll(async () => {
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
    passwords = app.get(PasswordService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('stores a public request with a DMD reference and files the customer', async () => {
    const body = valid();
    const res = await request(server()).post('/api/v1/quote-requests').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^DMD-\d{4}-\d{6}$/);
    expect(res.body.data.status).toBe('NEW');
    const row = await prisma.quoteRequest.findUniqueOrThrow({ where: { reference: res.body.data.reference }, include: { customer: true } });
    expect(row.service).toBe('EVENT');
    expect(row.size).toBe('grand');
    expect(row.quantity).toBe(2500);
    expect(row.email).toBe(body.email.toLowerCase());
    expect(row.customer?.fullName).toBe('Marie Joseph');
  });

  it('accepts optional fields left empty (consulting without quantity)', async () => {
    const res = await request(server()).post('/api/v1/quote-requests').send(valid({ service: 'conseil', size: '', quantity: '', message: '', company: '' }));
    expect(res.status).toBe(201);
    const row = await prisma.quoteRequest.findUniqueOrThrow({ where: { reference: res.body.data.reference } });
    expect(row.service).toBe('CONSULTING');
    expect(row.size).toBeNull();
    expect(row.quantity).toBeNull();
  });

  it('rejects invalid payloads (422) and unknown logos', async () => {
    const bad = await request(server()).post('/api/v1/quote-requests').send(valid({ service: 'autre', email: 'nope', products: '' }));
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    const logo = await request(server()).post('/api/v1/quote-requests').send(valid({ logoUploadId: '7f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b' }));
    expect(logo.status).toBe(422);
    expect(logo.body.error.code).toBe('UPLOAD_NOT_FOUND');
  });

  it('back-office: list with filters and newCount, detail, status + note with audit, RBAC', async () => {
    const created = await request(server()).post('/api/v1/quote-requests').send(valid({ service: 'sourcing', products: `Recherche ${suffix}` }));
    const ref = created.body.data.reference as string;
    const sales = await staff(StaffRole.SALES);

    const list = await get(`/admin/quote-requests?q=${suffix}&service=SOURCING`, sales);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].reference).toBe(ref);
    expect(list.body.meta.newCount).toBeGreaterThanOrEqual(1);
    const id = list.body.data[0].id as string;

    const detail = await get(`/admin/quote-requests/${id}`, sales);
    expect(detail.body.data.project).toBe(`Recherche ${suffix}`);

    const upd = await patch(`/admin/quote-requests/${id}`, sales, { status: 'IN_PROGRESS', internalNote: 'Rappeler lundi' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.status).toBe('IN_PROGRESS');
    expect(upd.body.data.internalNote).toBe('Rappeler lundi');
    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'QuoteRequest', entityId: id } });
    expect(audit?.action).toBe('quote_request.status_change');

    expect((await patch(`/admin/quote-requests/${id}`, sales, { status: 'BOGUS' })).status).toBe(422);
    expect((await get('/admin/quote-requests/nope', sales)).status).toBe(404);

    const production = await staff(StaffRole.PRODUCTION);
    expect((await get('/admin/quote-requests', production)).status).toBe(403);
    const accounting = await staff(StaffRole.ACCOUNTING);
    expect((await get(`/admin/quote-requests/${id}`, accounting)).status).toBe(200);
    expect((await patch(`/admin/quote-requests/${id}`, accounting, { status: 'WON' })).status).toBe(403);
    expect((await request(server()).get('/api/v1/admin/quote-requests')).status).toBe(401);
  });
});
