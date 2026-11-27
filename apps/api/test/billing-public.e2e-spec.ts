import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, StaffRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BillingStatsService } from '../src/billing/billing-stats.service';
import { setupApp } from '../src/setup-app';

const ORIGIN = 'http://localhost:3000';
const CUSTOMER = { name: 'Paul Charles', email: 'paul.default-mailer@example.com' };

/** Runs with the real default wiring (NotConfiguredDocumentMailer) and a low public throttle. */
describe('Billing: default mailer, throttling, stats (e2e)', () => {
  const prisma = new PrismaClient();
  let app: INestApplication;
  let cookie = '';
  let csrf = '';
  const suffix = Date.now().toString(36);

  const api = (method: 'get' | 'post', url: string) => {
    const r = request(app.getHttpServer())[method](`/api/v1${url}`).set('Cookie', cookie).set('Origin', ORIGIN);
    return method === 'get' ? r : r.set('x-csrf-token', csrf);
  };

  beforeAll(async () => {
    process.env.PUBLIC_DOC_THROTTLE_LIMIT = '5';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
    const email = `billpub${suffix}@example.com`;
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ fullName: 'Admin Test', email, password: 'Cafe-Pwa-Nwa-2026!', acceptTerms: true });
    const pairs = (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]);
    cookie = pairs.join('; ');
    csrf = pairs.find((p) => p.startsWith('ip_csrf='))!.slice('ip_csrf='.length);
    await prisma.user.update({ where: { email }, data: { isStaff: true, staffRole: StaffRole.ADMIN } });
  });

  afterAll(async () => {
    delete process.env.PUBLIC_DOC_THROTTLE_LIMIT;
    await app.close();
    await prisma.$disconnect();
  });

  it('answers 503 MAIL_NOT_CONFIGURED when sending without a mail provider and keeps the draft untouched', async () => {
    const created = await api('post', '/admin/documents').send({ type: 'QUOTE', customer: CUSTOMER, lines: [{ description: 'Casquette', quantity: '5', unitPrice: '300' }] });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const res = await api('post', `/admin/documents/${id}/send`).send({});
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MAIL_NOT_CONFIGURED');
    const after = await api('get', `/admin/documents/${id}`);
    expect(after.body.data.status).toBe('DRAFT');
    expect(after.body.data.sentAt).toBeNull();

    // Recording a send through another channel still works.
    const manual = await api('post', `/admin/documents/${id}/send`).send({ markAsSentOnly: true });
    expect(manual.status).toBe(200);
    expect(manual.body.data.status).toBe('SENT');
  });

  it('throttles the public endpoints', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await request(app.getHttpServer()).get(`/api/v1/public/documents/${'z'.repeat(43)}`)).status);
    }
    expect(statuses).toContain(429);
    expect(statuses[0]).toBe(404);
  });

  it('exposes BillingStatsService aggregates for the dashboard / customer pages', async () => {
    const stats = app.get(BillingStatsService);
    const revenue = await stats.revenueByCurrency();
    expect(Array.isArray(revenue)).toBe(true);
    const counts = await stats.documentCounts();
    expect(counts).toEqual(expect.objectContaining({}));
    expect(await stats.balancesByCustomer([])).toEqual(expect.anything());
  });
});
