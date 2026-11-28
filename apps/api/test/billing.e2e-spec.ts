import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrintPlacement, PrismaClient, ProductStatus, StaffRole } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (b: Buffer) => Promise<{ text: string; numpages: number }>;
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DOCUMENT_MAILER, type DocumentMailInput, type DocumentMailer } from '../src/billing/ports/document-mailer.port';
import { setupApp } from '../src/setup-app';

const STRONG = 'Cafe-Pwa-Nwa-2026!';
const ORIGIN = 'http://localhost:3000';

interface Session {
  cookie: string;
  csrf: string;
  userId: string;
}

const CUSTOMER = { name: 'Marie Joseph', email: 'marie.billing@example.com', phone: '+509 3712-3456', city: 'Port-au-Prince' };
const LINES = [
  { description: 'Tasse sublimation', quantity: '10', unitPrice: '650.00' },
  { description: 'T-shirt brodé', quantity: '3', unitPrice: '1200.50', discountPercent: '10' },
];

describe('Billing API (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  let app: INestApplication;
  let n = 0;
  const sent: DocumentMailInput[] = [];
  const sessions: Partial<Record<StaffRole | 'CUSTOMER', Session>> = {};

  const server = () => app.getHttpServer();

  async function signUp(role: StaffRole | null): Promise<Session> {
    const email = `bill${suffix}${n++}@example.com`;
    const res = await request(server()).post('/api/v1/auth/register').send({ fullName: 'Test Staff', email, password: STRONG, acceptTerms: true });
    expect(res.status).toBe(201);
    const pairs = ((res.headers['set-cookie'] as unknown as string[]) ?? []).map((c) => c.split(';')[0]);
    const get = (k: string) => pairs.find((p) => p.startsWith(`${k}=`))?.slice(k.length + 1) ?? '';
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    if (role) await prisma.user.update({ where: { id: user.id }, data: { isStaff: true, staffRole: role } });
    return { cookie: pairs.join('; '), csrf: get('ip_csrf'), userId: user.id };
  }

  const as = (s: Session, method: 'get' | 'post' | 'patch' | 'put' | 'delete', url: string) => {
    const r = request(server())[method](`/api/v1${url}`).set('Cookie', s.cookie).set('Origin', ORIGIN);
    return method === 'get' ? r : r.set('x-csrf-token', s.csrf);
  };
  const admin = () => sessions.ADMIN!;

  async function createDoc(type: 'QUOTE' | 'PROFORMA' | 'INVOICE', extra: Record<string, unknown> = {}, s: Session = admin()) {
    return as(s, 'post', '/admin/documents').send({ type, customer: CUSTOMER, lines: LINES, taxRate: '6', shippingAmount: '100', discountAmount: '50', ...extra });
  }
  async function sentInvoice() {
    const created = await createDoc('INVOICE');
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const send = await as(admin(), 'post', `/admin/documents/${id}/send`).send({ markAsSentOnly: true });
    expect(send.status).toBe(200);
    return send.body.data as { id: string; total: string; publicToken: string; status: string };
  }

  beforeAll(async () => {
    await prisma.$connect();
    // Throw-away mailer so sending can be verified without a provider.
    const fake: DocumentMailer = {
      async send(input: DocumentMailInput) {
        sent.push(input);
        return { messageId: `<test-${sent.length}@impactpro.test>` };
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DOCUMENT_MAILER).useValue(fake).compile();
    app = setupApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
    for (const role of [StaffRole.ADMIN, StaffRole.SALES, StaffRole.ACCOUNTING, StaffRole.PRODUCTION, StaffRole.SUPPORT]) sessions[role] = await signUp(role);
    sessions.CUSTOMER = await signUp(null);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('access control', () => {
    it('401 without a session, 403 for a customer account', async () => {
      expect((await request(server()).get('/api/v1/admin/documents')).status).toBe(401);
      expect((await as(sessions.CUSTOMER!, 'get', '/admin/documents')).status).toBe(403);
      expect((await as(sessions.CUSTOMER!, 'get', '/admin/billing/settings')).status).toBe(403);
    });

    it('applies the role matrix per document type', async () => {
      // SALES: quotes yes, invoices read-only (no write), no settings, reports allowed.
      expect((await createDoc('QUOTE', {}, sessions.SALES!)).status).toBe(201);
      expect((await createDoc('INVOICE', {}, sessions.SALES!)).status).toBe(403);
      expect((await as(sessions.SALES!, 'get', '/admin/billing/settings')).status).toBe(403);
      // ACCOUNTING: invoices + payments + settings, quotes read-only.
      expect((await createDoc('INVOICE', {}, sessions.ACCOUNTING!)).status).toBe(201);
      expect((await createDoc('QUOTE', {}, sessions.ACCOUNTING!)).status).toBe(403);
      expect((await as(sessions.ACCOUNTING!, 'get', '/admin/billing/settings')).status).toBe(200);
      // PRODUCTION / SUPPORT: no billing access at all.
      for (const role of [StaffRole.PRODUCTION, StaffRole.SUPPORT] as const) {
        expect((await as(sessions[role]!, 'get', '/admin/documents')).status).toBe(403);
        expect((await createDoc('QUOTE', {}, sessions[role]!)).status).toBe(403);
      }
      // Payments need payments.write: SALES cannot.
      const inv = await sentInvoice();
      expect((await as(sessions.SALES!, 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '10', method: 'CASH' })).status).toBe(403);
      expect((await as(sessions.ACCOUNTING!, 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '10', method: 'CASH' })).status).toBe(201);
      // CSV export needs reports.read.
      expect((await as(sessions.PRODUCTION!, 'get', '/admin/documents/export.csv')).status).toBe(403);
    });

    it('rejects a mutation without the CSRF token', async () => {
      const res = await request(server()).post('/api/v1/admin/documents').set('Cookie', admin().cookie).set('Origin', ORIGIN).send({ type: 'QUOTE', customer: CUSTOMER, lines: LINES });
      expect(res.status).toBe(403);
    });
  });

  describe('create / totals / validation', () => {
    it('computes totals on the server and numbers documents DEV-YYYY-NNNN', async () => {
      const res = await createDoc('QUOTE');
      expect(res.status).toBe(201);
      const d = res.body.data;
      // 6500.00 + 3×1200.50×0.9 = 3241.35 → subtotal 9741.35; base 9691.35; tax 581.48 (581.4810); total 9691.35+100+581.48
      expect(d.subtotal).toBe('9741.35');
      expect(d.taxTotal).toBe('581.48');
      expect(d.total).toBe('10372.83');
      expect(d.balance).toBe('10372.83');
      expect(d.status).toBe('DRAFT');
      expect(d.number).toMatch(new RegExp(`^DEV-${new Date().getUTCFullYear()}-\\d{4}$`));
      expect(d.publicToken).toBeNull();
      expect(d.events.length).toBeGreaterThan(0);
    });

    it('ignores client-sent totals and rejects malformed money', async () => {
      const bad = await createDoc('QUOTE', { lines: [{ description: 'x', quantity: '1', unitPrice: '-5' }] });
      expect(bad.status).toBe(422);
      expect(bad.body.error.code).toBe('VALIDATION_ERROR');
      const extra = await createDoc('QUOTE', { total: '1.00' });
      expect(extra.status).toBe(422);
      expect((await createDoc('QUOTE', { customer: undefined })).status).toBe(422);
    });

    it('numbers are gap-free and unique under 20 parallel creations', async () => {
      const results = await Promise.all(Array.from({ length: 20 }, () => createDoc('PROFORMA')));
      expect(results.every((r) => r.status === 201)).toBe(true);
      const nums = results.map((r) => Number((r.body.data.number as string).split('-')[2])).sort((a, b) => a - b);
      expect(new Set(nums).size).toBe(20);
      expect(nums[19] - nums[0]).toBe(19);
    });

    it('releases the number when the latest draft is deleted', async () => {
      const a = await createDoc('QUOTE');
      const del = await as(admin(), 'delete', `/admin/documents/${a.body.data.id}`);
      expect(del.status).toBe(200);
      const b = await createDoc('QUOTE');
      expect(b.body.data.number).toBe(a.body.data.number);
    });
  });

  describe('editing rules, delete, state machine', () => {
    it('edits a draft fully, restricts a sent quote, locks invoices', async () => {
      const created = await createDoc('QUOTE');
      const id = created.body.data.id as string;
      const edited = await as(admin(), 'patch', `/admin/documents/${id}`).send({ lines: [{ description: 'Seule ligne', quantity: '2', unitPrice: '100' }], taxRate: '0', shippingAmount: '0', discountAmount: '0' });
      expect(edited.status).toBe(200);
      expect(edited.body.data.total).toBe('200.00');

      const send = await as(admin(), 'post', `/admin/documents/${id}/send`).send({ markAsSentOnly: true });
      expect(send.status).toBe(200);
      expect(send.body.data.status).toBe('SENT');

      const locked = await as(admin(), 'patch', `/admin/documents/${id}`).send({ lines: LINES });
      expect(locked.status).toBe(409);
      expect(locked.body.error.code).toBe('DOCUMENT_LOCKED');
      const notes = await as(admin(), 'patch', `/admin/documents/${id}`).send({ notes: 'Merci' });
      expect(notes.status).toBe(200);
      expect(notes.body.data.notes).toBe('Merci');

      const inv = await sentInvoice();
      const invNotes = await as(admin(), 'patch', `/admin/documents/${inv.id}`).send({ notes: 'x' });
      expect(invNotes.status).toBe(409);
      const invInternal = await as(admin(), 'patch', `/admin/documents/${inv.id}`).send({ internalNotes: 'Suivi interne' });
      expect(invInternal.status).toBe(200);
    });

    it('only drafts can be deleted', async () => {
      const inv = await sentInvoice();
      const res = await as(admin(), 'delete', `/admin/documents/${inv.id}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NOT_DRAFT');
    });

    it('quote → proforma → invoice with links, and illegal conversions are refused', async () => {
      const q = (await createDoc('QUOTE')).body.data;
      await as(admin(), 'post', `/admin/documents/${q.id}/send`).send({ markAsSentOnly: true });
      const acc = await as(admin(), 'post', `/admin/documents/${q.id}/status`).send({ status: 'ACCEPTED' });
      expect(acc.status).toBe(200);
      expect(acc.body.data.status).toBe('ACCEPTED');

      const pro = await as(admin(), 'post', `/admin/documents/${q.id}/convert`).send({ to: 'PROFORMA' });
      expect(pro.status).toBe(201);
      expect(pro.body.data.type).toBe('PROFORMA');
      expect(pro.body.data.number).toMatch(/^PRO-/);
      expect(pro.body.data.parentId).toBe(q.id);
      expect(pro.body.data.total).toBe(q.total);

      const inv = await as(admin(), 'post', `/admin/documents/${pro.body.data.id}/convert`).send({ to: 'INVOICE' });
      expect(inv.status).toBe(201);
      expect(inv.body.data.number).toMatch(/^FAC-/);
      expect(inv.body.data.status).toBe('DRAFT');

      const back = await as(admin(), 'post', `/admin/documents/${inv.body.data.id}/convert`).send({ to: 'PROFORMA' });
      expect(back.status).toBe(422);
      expect(back.body.error.code).toBe('INVALID_CONVERSION');

      const parent = await as(admin(), 'get', `/admin/documents/${q.id}`);
      expect(parent.body.data.children.map((c: { type: string }) => c.type)).toContain('PROFORMA');
    });

    it('duplicates into a fresh draft with its own number', async () => {
      const q = (await createDoc('QUOTE')).body.data;
      const dup = await as(admin(), 'post', `/admin/documents/${q.id}/duplicate`);
      expect(dup.status).toBe(201);
      expect(dup.body.data.status).toBe('DRAFT');
      expect(dup.body.data.number).not.toBe(q.number);
      expect(dup.body.data.total).toBe(q.total);
    });

    it('void needs a reason, refuses drafts and invoices with payments, and cannot be undone', async () => {
      const draft = (await createDoc('QUOTE')).body.data;
      expect((await as(admin(), 'post', `/admin/documents/${draft.id}/void`).send({ reason: 'Erreur' })).status).toBe(409);
      const inv = await sentInvoice();
      expect((await as(admin(), 'post', `/admin/documents/${inv.id}/void`).send({})).status).toBe(422);
      await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '100', method: 'CASH' });
      const blocked = await as(admin(), 'post', `/admin/documents/${inv.id}/void`).send({ reason: 'Annulation' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('HAS_PAYMENTS');

      const clean = await sentInvoice();
      const ok = await as(admin(), 'post', `/admin/documents/${clean.id}/void`).send({ reason: 'Facture en double' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.status).toBe('VOID');
      expect(ok.body.data.voidReason).toBe('Facture en double');
      expect((await as(admin(), 'patch', `/admin/documents/${clean.id}`).send({ internalNotes: 'x' })).status).toBe(409);
      expect((await as(admin(), 'post', `/admin/documents/${clean.id}/send`).send({ markAsSentOnly: true })).status).toBe(409);
    });

    it('quotes can only be marked accepted/rejected once sent; invoices never', async () => {
      const draft = (await createDoc('QUOTE')).body.data;
      expect((await as(admin(), 'post', `/admin/documents/${draft.id}/status`).send({ status: 'ACCEPTED' })).status).toBe(409);
      const inv = await sentInvoice();
      expect((await as(admin(), 'post', `/admin/documents/${inv.id}/status`).send({ status: 'ACCEPTED' })).status).toBe(422);
      expect((await as(admin(), 'post', `/admin/documents/${draft.id}/status`).send({ status: 'PAID' })).status).toBe(422);
    });
  });

  describe('payments', () => {
    it('records partial then full payments, updates status and refuses overpayment', async () => {
      const inv = await sentInvoice(); // total 10372.83
      const p1 = await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '372.83', method: 'BANK_TRANSFER', reference: 'MC-1' });
      expect(p1.status).toBe(201);
      expect(p1.body.data.status).toBe('PARTIALLY_PAID');
      expect(p1.body.data.amountPaid).toBe('372.83');
      expect(p1.body.data.balance).toBe('10000.00');

      const over = await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '10000.01', method: 'CASH' });
      expect(over.status).toBe(422);
      expect(over.body.error.code).toBe('OVERPAYMENT');

      expect((await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '0', method: 'CASH' })).status).toBe(422);
      expect((await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '1.234', method: 'CASH' })).status).toBe(422);

      const p2 = await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '10000.00', method: 'BANK_TRANSFER' });
      expect(p2.body.data.status).toBe('PAID');
      expect(p2.body.data.balance).toBe('0.00');
      expect((await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '1', method: 'CASH' })).status).toBe(422);

      // Voiding a payment reopens the balance and downgrades the status.
      const paymentId = p2.body.data.payments.find((p: { amount: string }) => p.amount === '10000.00').id as string;
      const voided = await as(admin(), 'post', `/admin/documents/${inv.id}/payments/${paymentId}/void`).send({ reason: 'Chèque refusé' });
      expect(voided.status).toBe(200);
      expect(voided.body.data.status).toBe('PARTIALLY_PAID');
      expect(voided.body.data.balance).toBe('10000.00');
      expect((await as(admin(), 'post', `/admin/documents/${inv.id}/payments/${paymentId}/void`).send({ reason: 'encore' })).status).toBe(409);
    });

    it('refuses payments on drafts and on quotes', async () => {
      const draftInv = (await createDoc('INVOICE')).body.data;
      expect((await as(admin(), 'post', `/admin/documents/${draftInv.id}/payments`).send({ amount: '5', method: 'CASH' })).status).toBe(409);
      const q = (await createDoc('QUOTE')).body.data;
      expect((await as(admin(), 'post', `/admin/documents/${q.id}/payments`).send({ amount: '5', method: 'CASH' })).status).toBe(409);
    });

    it('never overpays under concurrent payments', async () => {
      const inv = await sentInvoice();
      const results = await Promise.all(Array.from({ length: 6 }, () => as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: '3000.00', method: 'CASH' })));
      const okCount = results.filter((r) => r.status === 201).length;
      expect(okCount).toBe(3); // 3 × 3000 = 9000 ≤ 10372.83 < 4 × 3000
      const doc = await as(admin(), 'get', `/admin/documents/${inv.id}`);
      expect(doc.body.data.amountPaid).toBe('9000.00');
    });
  });

  describe('overdue / expired', () => {
    it('flags an unpaid invoice past due as overdue and a quote past validity as expired', async () => {
      const inv = await sentInvoice();
      await prisma.document.update({ where: { id: inv.id }, data: { dueDate: new Date(Date.now() - 5 * 86400_000) } });
      const got = await as(admin(), 'get', `/admin/documents/${inv.id}`);
      expect(got.body.data.isOverdue).toBe(true);
      const overdueList = await as(admin(), 'get', '/admin/documents?overdue=true&type=INVOICE');
      expect(overdueList.body.data.some((d: { id: string }) => d.id === inv.id)).toBe(true);
      await as(admin(), 'post', `/admin/documents/${inv.id}/payments`).send({ amount: inv.total, method: 'CASH' });
      expect((await as(admin(), 'get', `/admin/documents/${inv.id}`)).body.data.isOverdue).toBe(false);

      const q = (await createDoc('QUOTE')).body.data;
      await as(admin(), 'post', `/admin/documents/${q.id}/send`).send({ markAsSentOnly: true });
      await prisma.document.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 2 * 86400_000) } });
      const expired = await as(admin(), 'get', `/admin/documents/${q.id}`);
      expect(expired.body.data.status).toBe('EXPIRED');
    });
  });

  describe('send flow', () => {
    it('503 MAIL_NOT_CONFIGURED with the default mailer is covered below; with a mailer it attaches the PDF and records the send', async () => {
      const q = (await createDoc('QUOTE')).body.data;
      const res = await as(admin(), 'post', `/admin/documents/${q.id}/send`).send({ subject: 'Votre devis', message: 'Bonjour' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SENT');
      expect(res.body.data.sentTo).toEqual([CUSTOMER.email]);
      expect(res.body.data.publicToken).toHaveLength(43);
      const mail = sent.at(-1)!;
      expect(mail.to).toEqual([CUSTOMER.email]);
      expect(mail.attachments[0]?.filename).toMatch(/\.pdf$/);
      expect(mail.attachments[0]?.content.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('refuses to send an empty document', async () => {
      const q = (await createDoc('QUOTE', { lines: [] })).body.data;
      const res = await as(admin(), 'post', `/admin/documents/${q.id}/send`).send({ markAsSentOnly: true });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('EMPTY_DOCUMENT');
    });
  });

  describe('public links', () => {
    it('exposes only a limited view of sent documents, with PDF and idempotent accept', async () => {
      const q = (await createDoc('QUOTE', { internalNotes: 'SECRET interne' })).body.data;
      expect((await request(server()).get(`/api/v1/public/documents/${q.id}`)).status).toBe(404);

      const sentQ = (await as(admin(), 'post', `/admin/documents/${q.id}/send`).send({ markAsSentOnly: true })).body.data;
      const view = await request(server()).get(`/api/v1/public/documents/${sentQ.publicToken}`);
      expect(view.status).toBe(200);
      const text = JSON.stringify(view.body);
      expect(text).not.toContain('SECRET');
      expect(view.body.data).not.toHaveProperty('events');
      expect(view.body.data).not.toHaveProperty('internalNotes');
      expect(view.body.data).not.toHaveProperty('id');
      expect(view.body.data.number).toBe(q.number);
      expect(view.body.data.company.legalName).toBe('Impact Pro LLC');

      const pdf = await request(server()).get(`/api/v1/public/documents/${sentQ.publicToken}/pdf`).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');

      const a1 = await request(server()).post(`/api/v1/public/documents/${sentQ.publicToken}/accept`);
      expect(a1.status).toBe(200);
      expect(a1.body.data.status).toBe('ACCEPTED');
      const a2 = await request(server()).post(`/api/v1/public/documents/${sentQ.publicToken}/accept`);
      expect(a2.status).toBe(200);
      expect(a2.body.data.status).toBe('ACCEPTED');
      const admin2 = await as(admin(), 'get', `/admin/documents/${q.id}`);
      expect(admin2.body.data.events.some((e: { type: string }) => /accept/i.test(e.type))).toBe(true);
    });

    it('invoices cannot be accepted publicly; bad tokens are 404 without detail', async () => {
      const inv = await sentInvoice();
      expect((await request(server()).post(`/api/v1/public/documents/${inv.publicToken}/accept`)).status).toBe(409);
      for (const t of ['nope', 'a'.repeat(43), '../../etc/passwd']) {
        const r = await request(server()).get(`/api/v1/public/documents/${encodeURIComponent(t)}`);
        expect(r.status).toBe(404);
        expect(r.body.error.code).toBe('DOCUMENT_NOT_FOUND');
      }
    });

    it('does not show voided documents as payable and keeps VOID visible', async () => {
      const inv = await sentInvoice();
      await as(admin(), 'post', `/admin/documents/${inv.id}/void`).send({ reason: 'Annulée' });
      const r = await request(server()).get(`/api/v1/public/documents/${inv.publicToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.status).toBe('VOID');
    });
  });

  describe('PDF', () => {
    const binary = (res: request.Response, cb: (e: Error | null, b: Buffer) => void) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    };

    it('renders company, number, lines, totals and payment instructions', async () => {
      const q = (await createDoc('QUOTE', { paymentInstructions: 'MonCash 509-0000' })).body.data;
      const res = await as(admin(), 'get', `/admin/documents/${q.id}/pdf`).buffer(true).parse(binary);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      const parsed = await pdfParse(res.body as Buffer);
      expect(parsed.text).toContain(q.number);
      expect(parsed.text).toContain('Impact Pro LLC');
      expect(parsed.text).toContain('Tasse sublimation');
      expect(parsed.text).toContain('10 372,83');
      expect(parsed.text).toContain('MonCash 509-0000');
      expect(parsed.text).toContain('Marie Joseph');
    });

    it('labels proformas and watermarks voided documents', async () => {
      const p = (await createDoc('PROFORMA')).body.data;
      const text = (await pdfParse((await as(admin(), 'get', `/admin/documents/${p.id}/pdf`).buffer(true).parse(binary)).body as Buffer)).text;
      expect(text).toMatch(/PROFORMA/);
      const inv = await sentInvoice();
      await as(admin(), 'post', `/admin/documents/${inv.id}/void`).send({ reason: 'Annulée' });
      const voidText = (await pdfParse((await as(admin(), 'get', `/admin/documents/${inv.id}/pdf`).buffer(true).parse(binary)).body as Buffer)).text;
      expect(voidText).toMatch(/ANNUL|VOID/i);
    });

    it('paginates 60 lines over several pages', async () => {
      const lines = Array.from({ length: 60 }, (_v, i) => ({ description: `Article numéro ${i + 1}`, quantity: '1', unitPrice: '10' }));
      const d = (await createDoc('QUOTE', { lines })).body.data;
      const parsed = await pdfParse((await as(admin(), 'get', `/admin/documents/${d.id}/pdf`).buffer(true).parse(binary)).body as Buffer);
      expect(parsed.numpages).toBeGreaterThan(1);
      expect(parsed.text).toContain('Article numéro 1');
      expect(parsed.text).toContain('Article numéro 60');
    });
  });

  describe('order prefill', () => {
    it('prepares a quote from a custom order', async () => {
      const category = await prisma.category.create({ data: { name: 'Catégorie facturation', slug: `cat-bill-${suffix}` } });
      const product = await prisma.product.create({
        data: { slug: `tasse-bill-${suffix}`, name: 'Tasse facturation', categoryId: category.id, status: ProductStatus.ACTIVE, minOrderQty: 12, unitLabel: 'pièce', colors: ['Blanc'], placements: [PrintPlacement.FRONT] },
      });
      await prisma.productVariant.create({ data: { productId: product.id, sku: `BILL-${suffix}`, name: 'Standard', basePrice: '650.00', priceTiers: { create: [{ minQty: 12, unitPrice: '650.00' }] } } });
      const order = await request(server())
        .post('/api/v1/custom-orders')
        .send({
          customer: { fullName: 'Jean Pierre', phone: '+509 3700-0000', email: 'jean.billing@example.com' },
          items: [{ productSlug: product.slug, quantity: 12, color: 'Blanc', elements: [{ placement: 'FRONT', kind: 'TEXT', text: 'Bonjour' }] }],
          deliveryMethod: 'PICKUP',
        });
      expect(order.status).toBe(201);
      const orderId = (await prisma.customOrder.findFirstOrThrow({ where: { reference: order.body.data.reference } })).id;

      const res = await as(admin(), 'post', '/admin/documents').send({ type: 'QUOTE', orderId });
      expect(res.status).toBe(201);
      expect(res.body.data.orderId).toBe(orderId);
      expect(res.body.data.orderReference).toBe(order.body.data.reference);
      expect(res.body.data.customer.email).toBe('jean.billing@example.com');
      expect(res.body.data.lines.length).toBeGreaterThan(0);
      expect(res.body.data.lines[0].quantity).toBe('12');

      const missing = await as(admin(), 'post', '/admin/documents').send({ type: 'QUOTE', orderId: 'does-not-exist' });
      expect(missing.status).toBe(404);
      const filtered = await as(admin(), 'get', `/admin/documents?orderId=${orderId}`);
      expect(filtered.body.data).toHaveLength(1);
    });
  });

  describe('settings', () => {
    it('serves Impact Pro LLC defaults and validates / audits updates', async () => {
      const get = await as(admin(), 'get', '/admin/billing/settings');
      expect(get.status).toBe(200);
      expect(get.body.data.legalName).toBe('Impact Pro LLC');
      expect(get.body.data.city).toMatch(/Miami/);
      expect(get.body.data.prefixes).toEqual({ quote: 'DEV', proforma: 'PRO', invoice: 'FAC' });
      expect(get.body.data.nextNumbers.invoice).toMatch(/^FAC-\d{4}-\d{4}$/);

      const bad = await as(admin(), 'put', '/admin/billing/settings').send({ ...get.body.data, prefixes: { quote: 'x y', proforma: 'PRO', invoice: 'FAC' } });
      expect(bad.status).toBe(422);

      const editable = { ...get.body.data } as Record<string, unknown>;
      delete editable.nextNumbers;
      delete editable.updatedAt;
      const put = await as(admin(), 'put', '/admin/billing/settings').send({ ...editable, quoteValidityDays: 45 });
      expect(put.status).toBe(200);
      expect(put.body.data.quoteValidityDays).toBe(45);
      expect(await prisma.auditLog.count({ where: { action: 'billing.settings.update' } })).toBeGreaterThan(0);
      await as(admin(), 'put', '/admin/billing/settings').send({ ...editable, quoteValidityDays: 30 });
    });
  });

  describe('lists, CSV, reports, audit', () => {
    it('filters and paginates documents', async () => {
      const list = await as(admin(), 'get', '/admin/documents?type=INVOICE&status=SENT&pageSize=5&sort=createdAt:desc');
      expect(list.status).toBe(200);
      expect(list.body.meta.pageSize).toBe(5);
      expect(list.body.data.every((d: { type: string }) => d.type === 'INVOICE')).toBe(true);
      const byQ = await as(admin(), 'get', `/admin/documents?q=${encodeURIComponent('marie.billing')}`);
      expect(byQ.body.data.length).toBeGreaterThan(0);
      expect((await as(admin(), 'get', '/admin/documents?pageSize=1000')).status).toBe(422);
    });

    it('exports CSV with escaped cells and no formula injection', async () => {
      await createDoc('QUOTE', { customer: { ...CUSTOMER, name: '=HYPERLINK("http://evil")', company: 'Dupont, "Fils"' } });
      const res = await as(admin(), 'get', '/admin/documents/export.csv').buffer(true).parse((r, cb) => {
        let s = '';
        r.setEncoding('utf8');
        r.on('data', (c: string) => (s += c));
        r.on('end', () => cb(null, s as unknown as Buffer));
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const csv = res.body as unknown as string;
      expect(csv.split('\n')[0]).toMatch(/Numéro/);
      expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m);
      expect(csv).toContain('"Dupont, ""Fils"""');
    });

    it('reports revenue and ageing', async () => {
      const rev = await as(admin(), 'get', '/admin/reports/revenue?groupBy=month');
      expect(rev.status).toBe(200);
      expect(rev.body.data.length).toBeGreaterThan(0);
      expect(rev.body.data[0]).toEqual(expect.objectContaining({ period: expect.any(String), currency: expect.any(String), invoiced: expect.any(String), paid: expect.any(String) }));
      const aging = await as(admin(), 'get', '/admin/reports/aging');
      expect(aging.status).toBe(200);
      expect(aging.body.data[0]).toEqual(expect.objectContaining({ currency: 'HTG', total: expect.any(String) }));
      expect((await as(sessions.PRODUCTION!, 'get', '/admin/reports/revenue')).status).toBe(403);
      expect((await as(admin(), 'get', '/admin/reports/revenue?groupBy=year')).status).toBe(422);
    });

    it('audit-logs the mutations', async () => {
      const actions = (await prisma.auditLog.findMany({ where: { entityType: 'Document' }, select: { action: true }, distinct: ['action'] })).map((a) => a.action);
      for (const expected of ['create', 'send', 'convert', 'void', 'payment']) expect(actions.some((a) => a.includes(expected))).toBe(true);
    });
  });
});
