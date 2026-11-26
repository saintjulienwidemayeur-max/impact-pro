import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrintPlacement, PrismaClient, ProductStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { setupApp } from '../src/setup-app';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const STRONG = 'Cafe-Pwa-Nwa-2026!';

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

/** Cookies from a Set-Cookie header list as a `Cookie:` request header + the individual raw lines. */
function jar(setCookie: string[] | undefined): { header: string; session: string; csrf: string; raw: string[] } {
  const raw = setCookie ?? [];
  const pairs = raw.map((c) => c.split(';')[0]);
  const get = (name: string) => pairs.find((p) => p.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
  return { header: pairs.join('; '), session: get('ip_session'), csrf: get('ip_csrf'), raw };
}

describe('Customer accounts (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  const productSlug = `tasse-acc-${suffix}`;
  let app: INestApplication;
  let n = 0;
  const email = (tag = 'u') => `${tag}${suffix}${n++}@example.com`;

  const server = () => app.getHttpServer();

  async function register(overrides: Record<string, unknown> = {}) {
    const body = { fullName: 'Marie Joseph', email: email(), password: STRONG, acceptTerms: true, ...overrides };
    const res = await request(server()).post('/api/v1/auth/register').send(body);
    return { res, body, cookies: jar(res.headers['set-cookie'] as unknown as string[]) };
  }

  async function login(emailAddr: string, password = STRONG, cookieHeader?: string) {
    const req = request(server()).post('/api/v1/auth/login').send({ email: emailAddr, password });
    if (cookieHeader) req.set('Cookie', cookieHeader);
    const res = await req;
    return { res, cookies: jar(res.headers['set-cookie'] as unknown as string[]) };
  }

  const orderBody = (customerEmail: string) => ({
    customer: { fullName: 'Marie Joseph', phone: '+509 3712-3456', email: customerEmail },
    items: [{ productSlug, quantity: 12, color: 'Blanc', elements: [{ placement: 'FRONT', kind: 'TEXT', text: 'Bonjour' }] }],
    deliveryMethod: 'PICKUP',
  });

  async function placeOrder(customerEmail: string, headers: Record<string, string> = {}) {
    const req = request(server()).post('/api/v1/custom-orders').send(orderBody(customerEmail));
    for (const [k, v] of Object.entries(headers)) req.set(k, v);
    return req;
  }

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.create({ data: { name: 'Catégorie comptes', slug: `cat-acc-${suffix}` } });
    const product = await prisma.product.create({
      data: {
        slug: productSlug,
        name: 'Tasse comptes',
        categoryId: category.id,
        status: ProductStatus.ACTIVE,
        minOrderQty: 12,
        unitLabel: 'pièce',
        colors: ['Blanc'],
        placements: [PrintPlacement.FRONT],
      },
    });
    await prisma.productVariant.create({
      data: { productId: product.id, sku: `ACC-${suffix}`, name: 'Standard', basePrice: '650.00', priceTiers: { create: [{ minQty: 12, unitPrice: '650.00' }] } },
    });
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /auth/register', () => {
    it('creates the account, hashes the password with Argon2id and signs the user in', async () => {
      const { res, body, cookies } = await register({ phone: '+509 3712-3456', email: `  ${email('Mixed')}  ` });
      expect(res.status).toBe(201);
      expect(res.body.data.user).toMatchObject({ fullName: 'Marie Joseph', role: 'CUSTOMER', emailVerified: false, phone: '+509 3712-3456' });
      expect(res.body.data.user.email).toBe((body.email as string).trim().toLowerCase());
      expect(res.body.data.csrfToken).toBe(cookies.csrf);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/i);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: res.body.data.user.email } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(STRONG);
      // The database keeps only the SHA-256 of the session token.
      const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
      expect(session.refreshTokenHash).toBe(sha256(cookies.session));
      expect(session.absoluteExpiresAt).not.toBeNull();
    });

    it('sets an HTTP-only SameSite=Lax session cookie and a readable CSRF cookie', async () => {
      const { cookies } = await register();
      const session = cookies.raw.find((c) => c.startsWith('ip_session='))!;
      const csrf = cookies.raw.find((c) => c.startsWith('ip_csrf='))!;
      expect(session).toMatch(/HttpOnly/i);
      expect(session).toMatch(/SameSite=Lax/i);
      expect(session).toMatch(/Path=\//);
      expect(session).toMatch(/Max-Age=\d+/);
      expect(csrf).not.toMatch(/HttpOnly/i);
      expect(csrf).toMatch(/SameSite=Lax/i);
      expect(cookies.session.length).toBeGreaterThanOrEqual(40);
    });

    it('marks the cookies Secure in production', async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const prodApp = await createApp();
      try {
        const res = await request(prodApp.getHttpServer())
          .post('/api/v1/auth/register')
          .send({ fullName: 'Prod User', email: email('prod'), password: STRONG, acceptTerms: true })
          .expect(201);
        for (const c of res.headers['set-cookie'] as unknown as string[]) expect(c).toMatch(/Secure/i);
      } finally {
        process.env.NODE_ENV = previous;
        await prodApp.close();
      }
    });

    it.each([
      ['password too short', { password: 'Short1!x' }, 'password'],
      ['password too common', { password: 'motdepasse123' }, 'password'],
      ['password only digits', { password: '4815162342' }, 'password'],
      ['password is a single repeated character', { password: 'aaaaaaaaaaaa' }, 'password'],
      ['password contains the e-mail name', { email: 'marielouise@example.com', password: 'xx-marielouise-xx' }, 'password'],
      ['password too long', { password: 'a1!'.repeat(200) }, 'password'],
      ['terms not accepted', { acceptTerms: false }, 'acceptTerms'],
      ['terms missing', { acceptTerms: undefined }, 'acceptTerms'],
      ['invalid e-mail', { email: 'not-an-email' }, 'email'],
      ['name too short', { fullName: 'M' }, 'fullName'],
      ['invalid phone', { phone: 'abc-12345' }, 'phone'],
    ])('rejects: %s', async (_label, override, field) => {
      const res = await request(server())
        .post('/api/v1/auth/register')
        .send({ fullName: 'Marie Joseph', email: email(), password: STRONG, acceptTerms: true, ...override });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('gives French messages and stable codes for password problems', async () => {
      const res = await request(server()).post('/api/v1/auth/register').send({ fullName: 'Marie', email: email(), password: 'password1', acceptTerms: true });
      const detail = res.body.error.details.find((d: { field: string }) => d.field === 'password');
      expect(detail.codes).toEqual(expect.arrayContaining(['TOO_SHORT', 'TOO_COMMON']));
      expect(detail.messages.join(' ')).toMatch(/mot de passe/i);
    });

    it('refuses unexpected fields (no privilege escalation through the body)', async () => {
      const res = await request(server())
        .post('/api/v1/auth/register')
        .send({ fullName: 'Marie Joseph', email: email(), password: STRONG, acceptTerms: true, isStaff: true });
      expect(res.status).toBe(422);
    });

    it('answers 409 EMAIL_TAKEN for a duplicate e-mail, whatever its case', async () => {
      const { body } = await register();
      const dup = await request(server())
        .post('/api/v1/auth/register')
        .send({ fullName: 'Autre', email: (body.email as string).toUpperCase(), password: STRONG, acceptTerms: true });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('survives two simultaneous sign-ups with the same e-mail (one wins, the other gets 409)', async () => {
      const shared = email('race');
      const attempts = await Promise.all(
        [1, 2, 3].map(() => request(server()).post('/api/v1/auth/register').send({ fullName: 'Race', email: shared, password: STRONG, acceptTerms: true })),
      );
      expect(attempts.filter((r) => r.status === 201)).toHaveLength(1);
      expect(attempts.filter((r) => r.status === 409)).toHaveLength(2);
    });

    it('rejects a request coming from a foreign origin', async () => {
      const res = await request(server())
        .post('/api/v1/auth/register')
        .set('Origin', 'https://evil.example')
        .send({ fullName: 'Marie Joseph', email: email(), password: STRONG, acceptTerms: true });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
      const ok = await request(server())
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({ fullName: 'Marie Joseph', email: email(), password: STRONG, acceptTerms: true });
      expect(ok.status).toBe(201);
    });
  });

  describe('POST /auth/login', () => {
    it('signs in, normalising the e-mail, and records the audit trail', async () => {
      const { body } = await register();
      const { res, cookies } = await login((body.email as string).toUpperCase());
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(body.email);
      expect(cookies.session).not.toBe('');
      const user = await prisma.user.findUniqueOrThrow({ where: { email: body.email as string } });
      expect(user.lastLoginAt).not.toBeNull();
      const actions = (await prisma.auditLog.findMany({ where: { actorId: user.id }, select: { action: true } })).map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining(['auth.register', 'auth.login']));
    });

    it('answers the same generic 401 for a wrong password and an unknown e-mail', async () => {
      const { body } = await register();
      const wrong = await login(body.email as string, 'definitely-wrong-password');
      const unknown = await login(email('ghost'), STRONG);
      expect(wrong.res.status).toBe(401);
      expect(unknown.res.status).toBe(401);
      const strip = (b: { error: { requestId?: string } }) => ({ ...b.error, requestId: undefined });
      expect(strip(wrong.res.body)).toEqual(strip(unknown.res.body));
      expect(wrong.res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrong.res.headers['set-cookie']).toBeUndefined();
    });

    it('runs an Argon2 verification even when the account does not exist (no timing oracle)', async () => {
      const passwords = app.get(PasswordService);
      const spy = jest.spyOn(passwords, 'verify');
      try {
        await login(email('nobody'), STRONG);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBeUndefined(); // → verified against the dummy hash
      } finally {
        spy.mockRestore();
      }
    });

    it('never logs the password or token in the audit rows', async () => {
      await login(email('audit'), 'my-secret-wrong-password');
      const rows = await prisma.auditLog.findMany({ where: { action: 'auth.login_failed' }, orderBy: { createdAt: 'desc' }, take: 5 });
      expect(JSON.stringify(rows)).not.toContain('my-secret-wrong-password');
      expect(JSON.stringify(rows)).not.toMatch(/@example\.com/); // only a short hash of the e-mail
    });

    it('locks an e-mail out after repeated failures — even with the right password — without affecting others', async () => {
      const { body } = await register();
      const target = body.email as string;
      for (let i = 0; i < 5; i++) expect((await login(target, 'wrong-password-123')).res.status).toBe(401);
      const locked = await login(target, STRONG);
      expect(locked.res.status).toBe(429);
      expect(locked.res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
      expect(locked.res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
      const other = await register();
      expect((await login(other.body.email as string)).res.status).toBe(200);
      // An unknown e-mail locks out just the same (nothing to enumerate).
      const ghost = email('ghost');
      for (let i = 0; i < 5; i++) await login(ghost, 'wrong-password-123');
      expect((await login(ghost, 'wrong-password-123')).res.status).toBe(429);
    });

    it('rotates the session: logging in again kills the cookie the browser presented', async () => {
      const first = await register();
      const second = await login(first.body.email as string, STRONG, first.cookies.header);
      expect(second.cookies.session).not.toBe(first.cookies.session);
      const stale = await request(server()).get('/api/v1/auth/me').set('Cookie', first.cookies.header);
      expect(stale.body.data.user).toBeNull();
      const fresh = await request(server()).get('/api/v1/auth/me').set('Cookie', second.cookies.header);
      expect(fresh.body.data.user.email).toBe(first.body.email);
    });

    it('blocks a disabled account', async () => {
      const { body } = await register();
      await prisma.user.update({ where: { email: body.email as string }, data: { status: 'DISABLED' } });
      expect((await login(body.email as string)).res.status).toBe(401);
    });
  });

  describe('GET /auth/me · CSRF · logout', () => {
    it('answers 200 { user: null } to guests and the user to a valid session', async () => {
      const guest = await request(server()).get('/api/v1/auth/me').expect(200);
      expect(guest.body.data).toEqual({ user: null, csrfToken: null });
      const { cookies, body } = await register();
      const me = await request(server()).get('/api/v1/auth/me').set('Cookie', cookies.header).expect(200);
      expect(me.body.data.user.email).toBe(body.email);
      expect(me.body.data.csrfToken).toBe(cookies.csrf);
    });

    it('ignores garbage and tampered session cookies', async () => {
      const { cookies } = await register();
      for (const bad of ['ip_session=garbage', `ip_session=${cookies.session}x`, 'ip_session=' + 'a'.repeat(500)]) {
        const res = await request(server()).get('/api/v1/auth/me').set('Cookie', bad).expect(200);
        expect(res.body.data.user).toBeNull();
      }
    });

    it('protected routes answer 401 without a session', async () => {
      for (const [method, path] of [['get', '/api/v1/auth/csrf'], ['patch', '/api/v1/auth/me'], ['post', '/api/v1/auth/logout'], ['get', '/api/v1/me/orders']] as const) {
        const res = await request(server())[method](path).send({});
        expect([method, path, res.status]).toEqual([method, path, 401]);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      }
    });

    it('requires a valid CSRF header on every state-changing request', async () => {
      const { cookies } = await register();
      const patch = (csrf?: string) => {
        const r = request(server()).patch('/api/v1/auth/me').set('Cookie', cookies.header).send({ fullName: 'Nouveau Nom' });
        return csrf === undefined ? r : r.set('x-csrf-token', csrf);
      };
      expect((await patch()).status).toBe(403);
      expect((await patch('wrong-token')).status).toBe(403);
      expect((await patch()).body.error.code).toBe('CSRF_INVALID');
      const ok = await patch(cookies.csrf);
      expect(ok.status).toBe(200);
      expect(ok.body.data.user.fullName).toBe('Nouveau Nom');
      // A CSRF token from another session does not work.
      const other = await register();
      expect((await patch(other.cookies.csrf)).status).toBe(403);
      // GETs need no token.
      await request(server()).get('/api/v1/me/orders').set('Cookie', cookies.header).expect(200);
    });

    it('updates the phone and clears it with null', async () => {
      const { cookies } = await register();
      const set = await request(server()).patch('/api/v1/auth/me').set('Cookie', cookies.header).set('x-csrf-token', cookies.csrf).send({ phone: '+1 305 555 0100' });
      expect(set.body.data.user.phone).toBe('+1 305 555 0100');
      const cleared = await request(server()).patch('/api/v1/auth/me').set('Cookie', cookies.header).set('x-csrf-token', cookies.csrf).send({ phone: null });
      expect(cleared.body.data.user.phone).toBeNull();
    });

    it('logout revokes the session server-side and clears both cookies', async () => {
      const { cookies } = await register();
      await request(server()).post('/api/v1/auth/logout').set('Cookie', cookies.header).expect(403); // no CSRF header
      const out = await request(server()).post('/api/v1/auth/logout').set('Cookie', cookies.header).set('x-csrf-token', cookies.csrf).expect(200);
      const cleared = (out.headers['set-cookie'] as unknown as string[]).join('\n');
      expect(cleared).toMatch(/ip_session=;/);
      expect(cleared).toMatch(/ip_csrf=;/);
      const row = await prisma.session.findUniqueOrThrow({ where: { refreshTokenHash: sha256(cookies.session) } });
      expect(row.revokedAt).not.toBeNull();
      // The old cookie is dead even if somebody kept a copy.
      const me = await request(server()).get('/api/v1/auth/me').set('Cookie', cookies.header).expect(200);
      expect(me.body.data.user).toBeNull();
    });

    it('expires sessions: idle (sliding) and absolute', async () => {
      const { cookies } = await register();
      const hash = sha256(cookies.session);
      await prisma.session.update({ where: { refreshTokenHash: hash }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await request(server()).get('/api/v1/auth/me').set('Cookie', cookies.header)).body.data.user).toBeNull();

      const second = await register();
      const hash2 = sha256(second.cookies.session);
      await prisma.session.update({ where: { refreshTokenHash: hash2 }, data: { absoluteExpiresAt: new Date(Date.now() - 1000) } });
      expect((await request(server()).get('/api/v1/auth/me').set('Cookie', second.cookies.header)).body.data.user).toBeNull();
    });

    it('slides the idle expiry forward while the session is used, never past the absolute limit', async () => {
      const { cookies } = await register();
      const hash = sha256(cookies.session);
      const soon = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.session.update({ where: { refreshTokenHash: hash }, data: { lastUsedAt: new Date(Date.now() - 60 * 60 * 1000), expiresAt: soon } });
      await request(server()).get('/api/v1/auth/me').set('Cookie', cookies.header).expect(200);
      const row = await prisma.session.findUniqueOrThrow({ where: { refreshTokenHash: hash } });
      expect(row.expiresAt.getTime()).toBeGreaterThan(soon.getTime() + 24 * 60 * 60 * 1000);
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(row.absoluteExpiresAt!.getTime());
    });
  });

  describe('POST /auth/change-password', () => {
    it('validates the current password and the policy, then revokes every other session', async () => {
      const { body, cookies: a } = await register();
      const { cookies: b } = await login(body.email as string);
      const call = (cookie: string, csrf: string, payload: Record<string, unknown>) =>
        request(server()).post('/api/v1/auth/change-password').set('Cookie', cookie).set('x-csrf-token', csrf).send(payload);

      const wrong = await call(a.header, a.csrf, { currentPassword: 'nope-nope-nope', newPassword: 'Another-Strong-Pass-9' });
      expect(wrong.status).toBe(422);
      expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
      const weak = await call(a.header, a.csrf, { currentPassword: STRONG, newPassword: 'password123' });
      expect(weak.status).toBe(422);
      expect(weak.body.error.details[0].field).toBe('newPassword');
      const same = await call(a.header, a.csrf, { currentPassword: STRONG, newPassword: STRONG });
      expect(same.body.error.code).toBe('PASSWORD_UNCHANGED');
      expect((await request(server()).post('/api/v1/auth/change-password').set('Cookie', a.header).send({})).status).toBe(403);

      const ok = await call(a.header, a.csrf, { currentPassword: STRONG, newPassword: 'Another-Strong-Pass-9' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.revokedSessions).toBe(1);
      // Session A (the one that changed the password) survives, session B is dead.
      expect((await request(server()).get('/api/v1/auth/me').set('Cookie', a.header)).body.data.user).not.toBeNull();
      expect((await request(server()).get('/api/v1/auth/me').set('Cookie', b.header)).body.data.user).toBeNull();
      // Old password no longer works, the new one does.
      expect((await login(body.email as string, STRONG)).res.status).toBe(401);
      expect((await login(body.email as string, 'Another-Strong-Pass-9')).res.status).toBe(200);
    });
  });

  describe('orders ↔ accounts', () => {
    it('attaches the order to the account only with a valid session AND CSRF header; guests are unchanged', async () => {
      const { cookies, body } = await register();
      const mine = await placeOrder(body.email as string, { Cookie: cookies.header, 'x-csrf-token': cookies.csrf });
      expect(mine.status).toBe(201);
      const guestNoCsrf = await placeOrder(body.email as string, { Cookie: cookies.header });
      const guest = await placeOrder(email('guest'));
      expect(guestNoCsrf.status).toBe(201);
      expect(guest.status).toBe(201);
      const rows = await prisma.customOrder.findMany({
        where: { reference: { in: [mine.body.data.reference, guestNoCsrf.body.data.reference, guest.body.data.reference] } },
        select: { reference: true, userId: true },
      });
      const owner = (ref: string) => rows.find((r) => r.reference === ref)?.userId;
      const me = await prisma.user.findUniqueOrThrow({ where: { email: body.email as string } });
      expect(owner(mine.body.data.reference)).toBe(me.id);
      expect(owner(guestNoCsrf.body.data.reference)).toBeNull();
      expect(owner(guest.body.data.reference)).toBeNull();
      // Tracking by reference + e-mail keeps working for everyone.
      await request(server()).get(`/api/v1/custom-orders/${mine.body.data.reference}`).query({ email: body.email }).expect(200);
    });

    it('lists my orders (paginated, newest first) and shows the detail without an e-mail', async () => {
      const { cookies, body } = await register();
      const headers = { Cookie: cookies.header, 'x-csrf-token': cookies.csrf };
      const refs: string[] = [];
      for (let i = 0; i < 3; i++) refs.push((await placeOrder(body.email as string, headers)).body.data.reference);

      const list = await request(server()).get('/api/v1/me/orders').query({ pageSize: 2 }).set('Cookie', cookies.header).expect(200);
      expect(list.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
      expect(list.body.data).toHaveLength(2);
      expect(list.body.data[0]).toMatchObject({ reference: refs[2], status: 'RECEIVED', currency: 'HTG', itemCount: 1, firstProductName: 'Tasse comptes' });
      expect(list.body.data[0].subtotal).toBe('7800.00');
      const page2 = await request(server()).get('/api/v1/me/orders').query({ pageSize: 2, page: 2 }).set('Cookie', cookies.header).expect(200);
      expect(page2.body.data.map((o: { reference: string }) => o.reference)).toEqual([refs[0]]);

      const detail = await request(server()).get(`/api/v1/me/orders/${refs[0]}`).set('Cookie', cookies.header).expect(200);
      expect(detail.body.data.reference).toBe(refs[0]);
      expect(detail.body.data.items[0].elements[0]).toMatchObject({ kind: 'TEXT', text: 'Bonjour' });
      await request(server()).get('/api/v1/me/orders').query({ pageSize: 500 }).set('Cookie', cookies.header).expect(422);
    });

    it('isolates accounts: nobody reads another user’s order (404), nor a guest order', async () => {
      const alice = await register();
      const bob = await register();
      const order = await placeOrder(alice.body.email as string, { Cookie: alice.cookies.header, 'x-csrf-token': alice.cookies.csrf });
      const ref = order.body.data.reference as string;
      const bobGet = await request(server()).get(`/api/v1/me/orders/${ref}`).set('Cookie', bob.cookies.header);
      expect(bobGet.status).toBe(404);
      expect(bobGet.body.error.code).toBe('ORDER_NOT_FOUND');
      const bobList = await request(server()).get('/api/v1/me/orders').set('Cookie', bob.cookies.header).expect(200);
      expect(bobList.body.data).toEqual([]);
      const guestOrder = await placeOrder(bob.body.email as string); // same e-mail as Bob, but placed as a guest
      expect((await request(server()).get(`/api/v1/me/orders/${guestOrder.body.data.reference}`).set('Cookie', bob.cookies.header)).status).toBe(404);
      // An unknown reference looks exactly like someone else's.
      const unknown = await request(server()).get('/api/v1/me/orders/IP-2026-999999').set('Cookie', bob.cookies.header);
      expect(unknown.status).toBe(404);
      expect(unknown.body.error).toEqual({ ...bobGet.body.error, requestId: unknown.body.error.requestId });
    });

    it('claims a guest order with reference + e-mail, and refuses everything else', async () => {
      const user = await register();
      const other = await register();
      const guestEmail = email('guestbuyer');
      const guest = await placeOrder(guestEmail);
      const ref = guest.body.data.reference as string;
      const claim = (who: typeof user, payload: Record<string, unknown>) =>
        request(server()).post('/api/v1/me/orders/claim').set('Cookie', who.cookies.header).set('x-csrf-token', who.cookies.csrf).send(payload);

      expect((await claim(user, { reference: ref, email: 'wrong@example.com' })).status).toBe(404);
      expect((await claim(user, { reference: 'IP-2026-999999', email: guestEmail })).status).toBe(404);
      expect((await request(server()).post('/api/v1/me/orders/claim').set('Cookie', user.cookies.header).send({ reference: ref, email: guestEmail })).status).toBe(403);
      expect((await claim(user, { reference: 'bad', email: guestEmail })).status).toBe(422);

      const ok = await claim(user, { reference: ref, email: guestEmail.toUpperCase() });
      expect(ok.status).toBe(200);
      expect(ok.body.data.reference).toBe(ref);
      expect((await claim(user, { reference: ref, email: guestEmail })).status).toBe(200); // idempotent
      const mine = await request(server()).get('/api/v1/me/orders').set('Cookie', user.cookies.header);
      expect(mine.body.data.map((o: { reference: string }) => o.reference)).toContain(ref);
      // Now owned: another account cannot take it over.
      expect((await claim(other, { reference: ref, email: guestEmail })).status).toBe(404);
      expect((await request(server()).get(`/api/v1/me/orders/${ref}`).set('Cookie', other.cookies.header)).status).toBe(404);
    });

    it('does not auto-claim guest orders that share the account e-mail', async () => {
      const guestEmail = email('earlier');
      const guest = await placeOrder(guestEmail);
      const { cookies } = await register({ email: guestEmail });
      const list = await request(server()).get('/api/v1/me/orders').set('Cookie', cookies.header).expect(200);
      expect(list.body.data).toEqual([]);
      expect(guest.status).toBe(201);
    });
  });

  describe('throttling', () => {
    it('limits sign-ups and logins per IP', async () => {
      const prevRegister = process.env.REGISTER_THROTTLE_LIMIT;
      const prevLogin = process.env.LOGIN_THROTTLE_LIMIT;
      process.env.REGISTER_THROTTLE_LIMIT = '2';
      process.env.LOGIN_THROTTLE_LIMIT = '3';
      const throttled = await createApp(); // own throttler storage
      const s = throttled.getHttpServer();
      try {
        const signup = () => request(s).post('/api/v1/auth/register').send({ fullName: 'Rate Limit', email: email('rl'), password: STRONG, acceptTerms: true });
        expect((await signup()).status).toBe(201);
        expect((await signup()).status).toBe(201);
        const third = await signup();
        expect(third.status).toBe(429);
        expect(third.body.error.code).toBe('TOO_MANY_REQUESTS');
        const attempt = () => request(s).post('/api/v1/auth/login').send({ email: email('rl-login'), password: STRONG });
        expect((await attempt()).status).toBe(401);
        expect((await attempt()).status).toBe(401);
        expect((await attempt()).status).toBe(401);
        expect((await attempt()).status).toBe(429);
      } finally {
        if (prevRegister === undefined) delete process.env.REGISTER_THROTTLE_LIMIT;
        else process.env.REGISTER_THROTTLE_LIMIT = prevRegister;
        if (prevLogin === undefined) delete process.env.LOGIN_THROTTLE_LIMIT;
        else process.env.LOGIN_THROTTLE_LIMIT = prevLogin;
        await throttled.close();
      }
    });
  });
});
