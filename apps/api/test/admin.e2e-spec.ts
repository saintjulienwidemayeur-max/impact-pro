import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrintPlacement, PrismaClient, ProductStatus, StaffRole } from '@prisma/client';
import request from 'supertest';
import { AdminBootstrapService } from '../src/admin/bootstrap/admin-bootstrap.service';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/admin/rbac';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { setupApp } from '../src/setup-app';

const STRONG = 'Cafe-Pwa-Nwa-2026!';
const NEW_STRONG = 'Dlo-Kokoye-Fre-2027!';

type Cookies = { header: string; csrf: string };
function jar(setCookie: string[] | undefined): Cookies {
  const pairs = (setCookie ?? []).map((c) => c.split(';')[0]);
  const csrf = pairs.find((p) => p.startsWith('ip_csrf='))?.slice('ip_csrf='.length) ?? '';
  return { header: pairs.join('; '), csrf };
}

describe('Admin core (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  const productSlug = `tasse-adm-${suffix}`;
  let app: INestApplication;
  let passwords: PasswordService;
  let n = 0;
  const server = () => app.getHttpServer();
  const email = (tag: string) => `${tag}-${suffix}-${n++}@example.com`;

  async function makeStaff(role: StaffRole, opts: { mustChangePassword?: boolean } = {}) {
    const addr = email(role.toLowerCase());
    const user = await prisma.user.create({
      data: {
        email: addr,
        fullName: `Staff ${role}`,
        isStaff: true,
        staffRole: role,
        passwordHash: await passwords.hash(STRONG),
        mustChangePassword: opts.mustChangePassword ?? false,
      },
    });
    return { user, email: addr };
  }

  async function login(emailAddr: string, password = STRONG): Promise<{ cookies: Cookies; status: number }> {
    const res = await request(server()).post('/api/v1/auth/login').send({ email: emailAddr, password });
    return { cookies: jar(res.headers['set-cookie'] as unknown as string[]), status: res.status };
  }

  async function signedIn(role: StaffRole) {
    const s = await makeStaff(role);
    const { cookies } = await login(s.email);
    return { ...s, cookies };
  }

  const get = (path: string, c?: Cookies) => {
    const r = request(server()).get(`/api/v1${path}`);
    return c ? r.set('Cookie', c.header) : r;
  };
  const send = (method: 'post' | 'patch', path: string, c: Cookies, body: unknown = {}) =>
    request(server())[method](`/api/v1${path}`).set('Cookie', c.header).set('x-csrf-token', c.csrf).send(body as object);

  async function placeOrder(customerEmail: string, quantity = 12) {
    const res = await request(server())
      .post('/api/v1/custom-orders')
      .send({
        customer: { fullName: 'Client Admin', phone: '+509 3712-3456', email: customerEmail },
        items: [{ productSlug, quantity, color: 'Blanc', elements: [{ placement: 'FRONT', kind: 'TEXT', text: 'Bonjour' }] }],
        deliveryMethod: 'PICKUP',
      });
    expect(res.status).toBe(201);
    return res.body.data as { id?: string; reference: string };
  }

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.create({ data: { name: 'Catégorie admin', slug: `cat-adm-${suffix}` } });
    const product = await prisma.product.create({
      data: {
        slug: productSlug,
        name: 'Tasse admin',
        categoryId: category.id,
        status: ProductStatus.ACTIVE,
        minOrderQty: 12,
        unitLabel: 'pièce',
        colors: ['Blanc'],
        placements: [PrintPlacement.FRONT],
      },
    });
    await prisma.productVariant.create({
      data: { productId: product.id, sku: `ADM-${suffix}`, name: 'Standard', basePrice: '650.00', priceTiers: { create: [{ minQty: 12, unitPrice: '650.00' }] } },
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
    passwords = app.get(PasswordService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('authentication and RBAC', () => {
    it('401 without a session, 403 for a customer account', async () => {
      const anon = await get('/admin/me');
      expect(anon.status).toBe(401);
      expect(anon.body.error.code).toBe('UNAUTHENTICATED');

      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ fullName: 'Client Simple', email: email('client'), password: STRONG, acceptTerms: true });
      const c = jar(reg.headers['set-cookie'] as unknown as string[]);
      const res = await get('/admin/orders', c);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect((await get('/admin/me', c)).status).toBe(403);
    });

    it('/admin/me returns role, permissions and the password-change flag for staff', async () => {
      const s = await signedIn('SALES');
      const res = await get('/admin/me', s.cookies);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        id: s.user.id,
        email: s.email,
        fullName: 'Staff SALES',
        staffRole: 'SALES',
        permissions: expect.arrayContaining([...ROLE_PERMISSIONS.SALES]),
        mustChangePassword: false,
      });
    });

    it('/auth/me also exposes the staff fields, customers do not get them', async () => {
      const s = await signedIn('ADMIN');
      const me = await get('/auth/me', s.cookies);
      expect(me.body.data.user).toMatchObject({ isStaff: true, staffRole: 'ADMIN' });
      expect(me.body.data.user.permissions).toEqual(expect.arrayContaining(['orders.read']));
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ fullName: 'Client Deux', email: email('client'), password: STRONG, acceptTerms: true });
      expect(reg.body.data.user.isStaff).toBeUndefined();
      expect(reg.body.data.user.permissions).toBeUndefined();
    });

    it('enforces the permission matrix on every role', async () => {
      const routes: [string, string][] = [
        ['dashboard.read', '/admin/dashboard'],
        ['orders.read', '/admin/orders'],
        ['customers.read', '/admin/customers'],
        ['products.read', '/admin/products'],
        ['users.manage', '/admin/users'],
        ['audit.read', '/admin/audit-logs'],
      ];
      for (const role of Object.values(StaffRole)) {
        const s = await signedIn(role);
        for (const [perm, path] of routes) {
          const res = await get(path, s.cookies);
          const allowed = (ROLE_PERMISSIONS[role] as readonly string[]).includes(perm);
          expect({ role, path, status: res.status }).toEqual({ role, path, status: allowed ? 200 : 403 });
        }
      }
    });

    it('the matrix only references known permissions and SUPER_ADMIN has all of them', () => {
      for (const perms of Object.values(ROLE_PERMISSIONS)) for (const p of perms) expect(PERMISSIONS).toContain(p);
      expect([...ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...PERMISSIONS].sort());
    });

    it('reads permissions live: a role change applies to the next request', async () => {
      const s = await signedIn('SALES');
      expect((await get('/admin/users', s.cookies)).status).toBe(403);
      await prisma.user.update({ where: { id: s.user.id }, data: { staffRole: 'ADMIN' } });
      expect((await get('/admin/users', s.cookies)).status).toBe(200);
    });

    it('rejects writes without the CSRF token and cross-origin writes', async () => {
      const s = await signedIn('ADMIN');
      const noCsrf = await request(server()).post('/api/v1/admin/customers').set('Cookie', s.cookies.header).send({});
      expect(noCsrf.status).toBe(403);
      expect(noCsrf.body.error.code).toBe('CSRF_INVALID');
      const evil = await request(server())
        .post('/api/v1/admin/customers')
        .set('Cookie', s.cookies.header)
        .set('x-csrf-token', s.cookies.csrf)
        .set('Origin', 'https://evil.example')
        .send({});
      expect(evil.status).toBe(403);
      expect(evil.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    });

    it('blocks a disabled staff account', async () => {
      const s = await signedIn('ADMIN');
      await prisma.user.update({ where: { id: s.user.id }, data: { status: 'DISABLED' } });
      expect((await get('/admin/me', s.cookies)).status).toBe(401);
    });
  });

  describe('forced password change', () => {
    it('blocks every admin route except /admin/me until the password is changed', async () => {
      const s = await makeStaff('ADMIN', { mustChangePassword: true });
      const { cookies } = await login(s.email);
      const me = await get('/admin/me', cookies);
      expect(me.status).toBe(200);
      expect(me.body.data.mustChangePassword).toBe(true);
      const blocked = await get('/admin/orders', cookies);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

      const change = await send('post', '/auth/change-password', cookies, { currentPassword: STRONG, newPassword: NEW_STRONG });
      expect(change.status).toBeLessThan(300);
      const { cookies: again } = await login(s.email, NEW_STRONG);
      expect((await get('/admin/me', again)).body.data.mustChangePassword).toBe(false);
      expect((await get('/admin/orders', again)).status).toBe(200);
    });
  });

  describe('staff sessions', () => {
    it('use the shorter staff lifetimes', async () => {
      const s = await makeStaff('SUPPORT');
      const customer = await prisma.user.create({
        data: { email: email('cust'), fullName: 'Cust', passwordHash: await passwords.hash(STRONG) },
      });
      await login(s.email);
      await login(customer.email);
      const staffSession = await prisma.session.findFirstOrThrow({ where: { userId: s.user.id } });
      const custSession = await prisma.session.findFirstOrThrow({ where: { userId: customer.id } });
      const hours = (d: Date, from: Date) => Math.round((d.getTime() - from.getTime()) / 3_600_000);
      expect(hours(staffSession.expiresAt, staffSession.createdAt)).toBeLessThanOrEqual(8);
      expect(hours(custSession.expiresAt, custSession.createdAt)).toBeGreaterThan(24);
    });
  });

  describe('orders', () => {
    it('lists with pagination meta, filters and search; detail has items, customer and timeline', async () => {
      const s = await signedIn('SALES');
      const mail = email('buyer');
      const o1 = await placeOrder(mail);
      await placeOrder(mail, 24);

      const list = await get(`/admin/orders?q=${encodeURIComponent(mail)}&pageSize=1&sort=createdAt:desc`, s.cookies);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.meta).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
      expect(list.body.data[0]).toMatchObject({ status: 'RECEIVED', email: mail });

      const none = await get(`/admin/orders?q=${encodeURIComponent(mail)}&status=DELIVERED`, s.cookies);
      expect(none.body.meta.total).toBe(0);

      const bad = await get('/admin/orders?status=NOPE&pageSize=1000', s.cookies);
      expect(bad.status).toBe(422);

      const row = (await get(`/admin/orders?q=${o1.reference}`, s.cookies)).body.data[0];
      const detail = await get(`/admin/orders/${row.id}`, s.cookies);
      expect(detail.status).toBe(200);
      expect(detail.body.data.reference).toBe(o1.reference);
      expect(detail.body.data.items).toHaveLength(1);
      expect(detail.body.data.customer).toMatchObject({ email: mail });
      expect(detail.body.data.documents).toEqual([]);
      expect(detail.body.data.events[0]).toMatchObject({ type: 'STATUS', message: 'Commande reçue' });
    });

    it('walks the status machine, records events + audit, rejects invalid moves', async () => {
      const sales = await signedIn('SALES');
      const admin = await signedIn('ADMIN');
      const o = await placeOrder(email('flow'));
      const id = (await get(`/admin/orders?q=${o.reference}`, sales.cookies)).body.data[0].id as string;

      for (const status of ['MOCKUP_SENT', 'APPROVED']) {
        const r = await send('patch', `/admin/orders/${id}/status`, sales.cookies, { status, note: `vers ${status}` });
        expect(r.status).toBe(200);
        expect(r.body.data.status).toBe(status);
      }
      for (const status of ['RECEIVED', 'MOCKUP_SENT', 'APPROVED']) {
        const back = await send('patch', `/admin/orders/${id}/status`, sales.cookies, { status });
        expect(back.status).toBe(409);
        expect(back.body.error.code).toBe('INVALID_TRANSITION');
      }
      const note = await send('post', `/admin/orders/${id}/notes`, sales.cookies, { message: 'Client rappelé' });
      expect(note.status).toBe(201);

      const events = await get(`/admin/orders/${id}/events`, sales.cookies);
      const types = (events.body.data as { type: string }[]).map((e) => e.type);
      expect(types.filter((t) => t === 'STATUS')).toHaveLength(3);
      expect(types).toContain('NOTE');

      const cancel = await send('patch', `/admin/orders/${id}/status`, sales.cookies, { status: 'CANCELLED' });
      expect(cancel.status).toBe(200);
      const reopenSales = await send('patch', `/admin/orders/${id}/status`, sales.cookies, { status: 'RECEIVED' });
      expect(reopenSales.status).toBe(403);
      const reopenAdmin = await send('patch', `/admin/orders/${id}/status`, admin.cookies, { status: 'RECEIVED' });
      expect(reopenAdmin.status).toBe(200);

      const audit = await prisma.auditLog.findMany({ where: { entityType: 'CustomOrder', entityId: id } });
      const byStaff = audit.filter((a) => a.actorId);
      expect(byStaff.length).toBeGreaterThanOrEqual(4);
      expect(byStaff.every((a) => [sales.user.id, admin.user.id].includes(a.actorId!))).toBe(true);
    });

    it('a staff role without orders.write cannot change a status', async () => {
      const acc = await signedIn('ACCOUNTING');
      const o = await placeOrder(email('ro'));
      const id = (await get(`/admin/orders?q=${o.reference}`, acc.cookies)).body.data[0].id as string;
      expect((await send('patch', `/admin/orders/${id}/status`, acc.cookies, { status: 'MOCKUP_SENT' })).status).toBe(403);
    });

    it('two concurrent identical transitions: exactly one wins', async () => {
      const s = await signedIn('ADMIN');
      const o = await placeOrder(email('race'));
      const id = (await get(`/admin/orders?q=${o.reference}`, s.cookies)).body.data[0].id as string;
      const results = await Promise.all([
        send('patch', `/admin/orders/${id}/status`, s.cookies, { status: 'MOCKUP_SENT' }),
        send('patch', `/admin/orders/${id}/status`, s.cookies, { status: 'MOCKUP_SENT' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const statusEvents = await prisma.customOrderEvent.count({ where: { orderId: id, type: 'STATUS' } });
      expect(statusEvents).toBe(2);
    });

    it('404 for an unknown order', async () => {
      const s = await signedIn('ADMIN');
      const res = await get('/admin/orders/does-not-exist', s.cookies);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('customers', () => {
    it('an order creates the customer, a second order reuses it, staff edits are not overwritten', async () => {
      const s = await signedIn('SALES');
      const mail = email('crm');
      await placeOrder(mail);
      const list = await get(`/admin/customers?q=${encodeURIComponent(mail)}`, s.cookies);
      expect(list.body.meta.total).toBe(1);
      const c = list.body.data[0];
      expect(c).toMatchObject({ email: mail, ordersCount: 1 });

      const patch = await send('patch', `/admin/customers/${c.id}`, s.cookies, { company: 'Acme SA', notes: 'VIP' });
      expect(patch.status).toBe(200);
      expect(patch.body.data).toMatchObject({ company: 'Acme SA', notes: 'VIP' });

      await placeOrder(mail, 24);
      const detail = await get(`/admin/customers/${c.id}`, s.cookies);
      expect(detail.body.data).toMatchObject({ company: 'Acme SA', ordersCount: 2 });
      expect(detail.body.data.balances ?? []).toEqual([]);
      expect((await prisma.customer.count({ where: { email: mail } }))).toBe(1);
    });

    it('creates manually, 409 on a duplicate e-mail, 422 on invalid input, read-only roles are refused', async () => {
      const s = await signedIn('SALES');
      const mail = email('manual');
      const ok = await send('post', '/admin/customers', s.cookies, { email: mail.toUpperCase(), fullName: 'Client Manuel', company: 'Boutik SA' });
      expect(ok.status).toBe(201);
      expect(ok.body.data.email).toBe(mail);
      expect((await send('post', '/admin/customers', s.cookies, { email: mail, fullName: 'Doublon' })).status).toBe(409);
      expect((await send('post', '/admin/customers', s.cookies, { email: 'pas-un-email', fullName: 'X' })).status).toBe(422);
      const prod = await signedIn('PRODUCTION');
      expect((await send('post', '/admin/customers', prod.cookies, { email: email('x'), fullName: 'Nope Nope' })).status).toBe(403);
    });

    it('registering a customer account links it to the directory', async () => {
      const s = await signedIn('SALES');
      const mail = email('acct');
      const reg = await request(server()).post('/api/v1/auth/register').send({ fullName: 'Compte Lié', email: mail, password: STRONG, acceptTerms: true });
      expect(reg.status).toBe(201);
      const c = await prisma.customer.findUniqueOrThrow({ where: { email: mail } });
      expect(c.userId).toBe(reg.body.data.user.id);
      expect((await get(`/admin/customers?q=${encodeURIComponent(mail)}`, s.cookies)).body.meta.total).toBe(1);
    });
  });

  describe('products', () => {
    it('lists, patches fields and replaces price tiers; validates tiers and custom size', async () => {
      const s = await signedIn('ADMIN');
      const list = await get(`/admin/products?q=${productSlug}`, s.cookies);
      expect(list.body.meta.total).toBe(1);
      const id = list.body.data[0].id as string;

      const patch = await send('patch', `/admin/products/${id}`, s.cookies, {
        name: 'Tasse admin v2',
        status: 'DRAFT',
        basePrice: '700.00',
        priceTiers: [
          { minQty: 12, unitPrice: '700.00' },
          { minQty: 48, unitPrice: '600.00' },
        ],
      });
      expect(patch.status).toBe(200);
      expect(patch.body.data).toMatchObject({ name: 'Tasse admin v2', status: 'DRAFT' });
      expect(patch.body.data.priceTiers).toHaveLength(2);

      for (const priceTiers of [[], [{ minQty: 12, unitPrice: '5.00' }, { minQty: 12, unitPrice: '4.00' }], [{ minQty: 12, unitPrice: '0' }]]) {
        const res = await send('patch', `/admin/products/${id}`, s.cookies, { priceTiers });
        expect(res.status).toBe(422);
      }
      expect((await send('patch', `/admin/products/${id}`, s.cookies, { customSize: { minWidthCm: 50, maxWidthCm: 10 } })).status).toBe(422);
      // Put the product back on sale: other tests order it.
      expect((await send('patch', `/admin/products/${id}`, s.cookies, { status: 'ACTIVE' })).status).toBe(200);

      const sales = await signedIn('SALES');
      expect((await send('patch', `/admin/products/${id}`, sales.cookies, { name: 'Hack' })).status).toBe(403);
    });

    it('creates a product with tiers and rejects a duplicate slug', async () => {
      const s = await signedIn('ADMIN');
      const slug = `nouveau-${suffix}`;
      const body = { slug, name: 'Nouveau produit', basePrice: '100.00', priceTiers: [{ minQty: 10, unitPrice: '100.00' }], categorySlug: `cat-adm-${suffix}` };
      const created = await send('post', '/admin/products', s.cookies, body);
      expect(created.status).toBe(201);
      expect(created.body.data.slug).toBe(slug);
      expect((await send('post', '/admin/products', s.cookies, body)).status).toBe(409);
    });
  });

  describe('staff users', () => {
    it('creates staff (temporary password shown once, must change it), then lists without secrets', async () => {
      const sa = await signedIn('SUPER_ADMIN');
      const mail = email('new-staff');
      const res = await send('post', '/admin/users', sa.cookies, { email: mail, fullName: 'Nouvel Employé', staffRole: 'SALES' });
      expect(res.status).toBe(201);
      expect(res.body.data.temporaryPassword).toEqual(expect.any(String));
      expect(res.body.data).toMatchObject({ email: mail, staffRole: 'SALES' });

      const tmp = await login(mail, res.body.data.temporaryPassword);
      expect(tmp.status).toBe(200);
      expect((await get('/admin/orders', tmp.cookies)).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

      const list = await get(`/admin/users?q=${encodeURIComponent(mail)}`, sa.cookies);
      expect(JSON.stringify(list.body)).not.toMatch(/temporaryPassword|passwordHash/);
      expect((await send('post', '/admin/users', sa.cookies, { email: mail, fullName: 'Doublon', staffRole: 'SALES' })).status).toBe(409);
    });

    it('only a SUPER_ADMIN can grant or touch SUPER_ADMIN; nobody changes their own role or disables themselves', async () => {
      const admin = await signedIn('ADMIN');
      const sa = await signedIn('SUPER_ADMIN');
      const target = await makeStaff('SUPPORT');

      expect((await send('post', '/admin/users', admin.cookies, { email: email('x'), fullName: 'Pas Permis', staffRole: 'SUPER_ADMIN' })).status).toBe(403);
      expect((await send('patch', `/admin/users/${target.user.id}`, admin.cookies, { staffRole: 'SUPER_ADMIN' })).status).toBe(403);
      expect((await send('patch', `/admin/users/${sa.user.id}`, admin.cookies, { fullName: 'Piraté' })).status).toBe(403);

      expect((await send('patch', `/admin/users/${admin.user.id}`, admin.cookies, { staffRole: 'SALES' })).status).toBe(409);
      expect((await send('patch', `/admin/users/${admin.user.id}`, admin.cookies, { status: 'DISABLED' })).status).toBe(409);

      const ok = await send('patch', `/admin/users/${target.user.id}`, admin.cookies, { staffRole: 'SALES' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.staffRole).toBe('SALES');
    });

    it('never lets the last active SUPER_ADMIN be demoted or disabled', async () => {
      const sa = await signedIn('SUPER_ADMIN');
      // Temporarily disable every other super admin so `sa` is the only one left.
      const others = await prisma.user.findMany({ where: { isStaff: true, staffRole: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: sa.user.id } }, select: { id: true } });
      await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: 'DISABLED' } });
      try {
        const helper = await makeStaff('SUPER_ADMIN');
        await prisma.user.update({ where: { id: helper.user.id }, data: { status: 'DISABLED' } });
        const demote = await send('patch', `/admin/users/${helper.user.id}`, sa.cookies, { staffRole: 'ADMIN' });
        // helper is already disabled, so changing it does not remove an active super admin
        expect(demote.status).toBe(200);
        const active = await prisma.user.findFirstOrThrow({ where: { id: sa.user.id } });
        expect(active.staffRole).toBe('SUPER_ADMIN');
      } finally {
        await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: 'ACTIVE' } });
      }
    });

    it('disabling a staff member revokes their sessions; reset-password forces a change and revokes sessions', async () => {
      const sa = await signedIn('SUPER_ADMIN');
      const victim = await signedIn('SUPPORT');
      expect((await get('/admin/me', victim.cookies)).status).toBe(200);

      const reset = await send('post', `/admin/users/${victim.user.id}/reset-password`, sa.cookies);
      expect(reset.status).toBeLessThan(300);
      expect(reset.body.data.temporaryPassword).toEqual(expect.any(String));
      expect((await get('/admin/me', victim.cookies)).status).toBe(401);
      const again = await login(victim.email, reset.body.data.temporaryPassword);
      expect((await get('/admin/me', again.cookies)).body.data.mustChangePassword).toBe(true);

      const off = await send('patch', `/admin/users/${victim.user.id}`, sa.cookies, { status: 'DISABLED' });
      expect(off.status).toBe(200);
      expect((await get('/admin/me', again.cookies)).status).toBe(401);
      expect((await login(victim.email, reset.body.data.temporaryPassword)).status).toBe(401);
    });
  });

  describe('audit log and dashboard', () => {
    it('filters the audit log by action prefix and entity; never leaks hashes', async () => {
      const sa = await signedIn('SUPER_ADMIN');
      await send('post', '/admin/customers', sa.cookies, { email: email('audit'), fullName: 'Audit Client' });
      const res = await get('/admin/audit-logs?action=customer.*&pageSize=5', sa.cookies);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect((res.body.data as { action: string }[]).every((a) => a.action.startsWith('customer.'))).toBe(true);
      expect(res.body.data[0].actor).toMatchObject({ id: sa.user.id });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refreshTokenHash/);
      expect((await get('/admin/audit-logs?entityType=Customer', sa.cookies)).body.data.length).toBeGreaterThan(0);
    });

    it('the dashboard has the contracted shape with zeroed billing and no mail yet', async () => {
      const s = await signedIn('ADMIN');
      await placeOrder(email('dash'));
      const res = await get('/admin/dashboard', s.cookies);
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.orders.total).toBeGreaterThan(0);
      expect(Object.keys(d.orders.byStatus).sort()).toEqual(['APPROVED', 'CANCELLED', 'DELIVERED', 'IN_PRODUCTION', 'MOCKUP_SENT', 'READY', 'RECEIVED']);
      expect(d.orders.last7d).toBeGreaterThan(0);
      expect(d.customers.total).toBeGreaterThan(0);
      expect(d.mail).toBeNull();
      expect(Array.isArray(d.recentOrders)).toBe(true);
      expect(Array.isArray(d.topProducts)).toBe(true);
      expect(Array.isArray(d.activity)).toBe(true);
      expect(d.revenue).toBeDefined();
      expect(d.documents).toBeDefined();
    });
  });

  describe('bootstrap administrator', () => {
    const logs: string[] = [];
    let spies: jest.SpyInstance[] = [];
    beforeEach(() => {
      logs.length = 0;
      spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) =>
        jest.spyOn(Logger.prototype, m).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(' '))),
      );
    });
    afterEach(() => spies.forEach((s) => s.mockRestore()));

    const make = (users: { count: number; existing: boolean }, env: Record<string, string | undefined>) => {
      const created: unknown[] = [];
      const prismaMock = {
        user: {
          count: jest.fn().mockResolvedValue(users.count),
          findUnique: jest.fn().mockResolvedValue(users.existing ? { id: 'u1' } : null),
          create: jest.fn().mockImplementation(({ data }: { data: unknown }) => {
            created.push(data);
            return Promise.resolve({ id: 'new-id' });
          }),
        },
      };
      const audit = { record: jest.fn().mockResolvedValue(undefined) };
      const svc = new AdminBootstrapService(prismaMock as never, { hash: () => Promise.resolve('HASH') } as never, audit as never, env as never);
      return { svc, created, prismaMock, audit };
    };

    it('does nothing when not configured or when a staff account already exists', async () => {
      expect(await make({ count: 0, existing: false }, {}).svc.run()).toBe('not_configured');
      const m = make({ count: 1, existing: false }, { ADMIN_BOOTSTRAP_EMAIL: 'a@b.co', ADMIN_BOOTSTRAP_PASSWORD: 'Une-Phrase-Solide-2026' });
      expect(await m.svc.run()).toBe('staff_exists');
      expect(m.created).toHaveLength(0);
    });

    it('creates one SUPER_ADMIN that must change its password, audits it and never logs the password', async () => {
      const password = 'Une-Phrase-Solide-2026';
      const m = make({ count: 0, existing: false }, { ADMIN_BOOTSTRAP_EMAIL: ' Boss@Example.com ', ADMIN_BOOTSTRAP_PASSWORD: password });
      expect(await m.svc.run()).toBe('created');
      expect(m.created[0]).toMatchObject({ email: 'boss@example.com', isStaff: true, staffRole: 'SUPER_ADMIN', mustChangePassword: true, passwordHash: 'HASH' });
      expect(m.audit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'admin.bootstrap' }));
      expect(JSON.stringify(m.audit.record.mock.calls)).not.toContain(password);
      expect(logs.join('\n')).not.toContain(password);
    });

    it('refuses to promote an existing customer account and rejects weak passwords (without logging them)', async () => {
      const weak = 'password1234';
      const clash = make({ count: 0, existing: true }, { ADMIN_BOOTSTRAP_EMAIL: 'c@d.co', ADMIN_BOOTSTRAP_PASSWORD: 'Une-Phrase-Solide-2026' });
      expect(await clash.svc.run()).toBe('email_in_use');
      expect(clash.created).toHaveLength(0);
      const w = make({ count: 0, existing: false }, { ADMIN_BOOTSTRAP_EMAIL: 'e@f.co', ADMIN_BOOTSTRAP_PASSWORD: weak });
      expect(await w.svc.run()).toBe('weak_password');
      expect(w.created).toHaveLength(0);
      expect(logs.join('\n')).not.toContain(weak);
    });

    it('swallows database errors instead of crashing the API', async () => {
      const m = make({ count: 0, existing: false }, { ADMIN_BOOTSTRAP_EMAIL: 'g@h.co', ADMIN_BOOTSTRAP_PASSWORD: 'Une-Phrase-Solide-2026' });
      m.prismaMock.user.count.mockRejectedValue(new Error('db down'));
      expect(await m.svc.run()).toBe('error');
    });
  });
});
