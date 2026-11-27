// Contract-faithful mock of the admin API (docs/admin-contract.md §1–§3, §5).
// In-memory, resettable via POST /__reset. Used by the default Playwright suite; no secrets (test-only credentials).
import http from "node:http";
import { randomBytes } from "node:crypto";

const PORT = Number(process.argv[2] ?? 4101);
export const TEST_PASSWORD = "Passw0rd-test-12";

const ROLE_PERMS = {
  ADMIN: ["dashboard.read", "orders.read", "orders.write", "customers.read", "customers.write", "quotes.read", "quotes.write", "invoices.read", "invoices.write", "payments.write", "billing.settings", "products.read", "products.write", "mail.read", "mail.send", "users.manage", "audit.read", "reports.read"],
  SALES: ["dashboard.read", "orders.read", "orders.write", "customers.read", "customers.write", "quotes.read", "quotes.write", "invoices.read", "products.read", "mail.read", "mail.send", "reports.read"],
  ACCOUNTING: ["dashboard.read", "orders.read", "customers.read", "quotes.read", "invoices.read", "invoices.write", "payments.write", "billing.settings", "reports.read", "mail.read", "mail.send"],
  PRODUCTION: ["dashboard.read", "orders.read", "orders.write", "products.read"],
  SUPPORT: ["dashboard.read", "orders.read", "customers.read", "customers.write", "mail.read", "mail.send"],
};
ROLE_PERMS.SUPER_ADMIN = ROLE_PERMS.ADMIN;

const ORDER_FLOW = ["RECEIVED", "MOCKUP_SENT", "APPROVED", "IN_PRODUCTION", "READY", "DELIVERED"];

// ---------- billing math (same formula as the contract) ----------
const round2 = (x) => {
  const s = x < 0 ? -1 : 1;
  return (s * Math.floor(Math.abs(x) * 100 + 0.5 + 1e-9)) / 100;
};
const fx = (n) => (Math.round(n * 100) / 100).toFixed(2);
function totals(doc) {
  let subtotal = 0;
  for (const l of doc.lines) {
    l.lineTotal = fx(round2(Number(l.quantity) * Number(l.unitPrice) * (1 - (Number(l.discountPercent) || 0) / 100)));
    subtotal += Number(l.lineTotal);
  }
  const base = Math.max(0, subtotal - Number(doc.discountAmount || 0));
  const tax = round2(base * (Number(doc.taxRate) / 100));
  const total = base + Number(doc.shippingAmount || 0) + tax;
  const paid = doc.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + Number(p.amount), 0);
  doc.subtotal = fx(subtotal);
  doc.taxTotal = fx(tax);
  doc.total = fx(total);
  doc.amountPaid = fx(paid);
  doc.balance = fx(total - paid);
}

let S;
let seq;
const id = (p) => `${p}_${(++seq).toString(36).padStart(6, "0")}`;
const now = () => new Date().toISOString();
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

function reset() {
  seq = 0;
  S = {
    mail: false,
    users: [],
    sessions: new Map(),
    customers: [],
    orders: [],
    documents: [],
    counters: {},
    audit: [],
    settings: {
      legalName: "Impact Pro LLC",
      address: "Miami, Florida, USA",
      city: "Miami",
      country: "US",
      phone: "+1 000 000 0000",
      email: "contact@example.com",
      website: null,
      taxId: null,
      defaultCurrency: "HTG",
      defaultTaxRate: "0.00",
      paymentTermsDays: 15,
      quoteValidityDays: 30,
      prefixes: { quote: "DEV", proforma: "PRO", invoice: "FAC" },
      bankDetails: null,
      paymentInstructions: "MonCash / Zelle",
      defaultTerms: "Paiement à 15 jours.",
      footerNote: null,
      logoUrl: null,
    },
    products: [
      { id: "prod_mug", slug: "tasse-sublimation", name: "Tasse sublimation", description: "Tasse blanche 11 oz.", status: "ACTIVE", category: { id: "cat_1", slug: "tasses", name: "Tasses" }, basePrice: "450.00", compareAtPrice: null, currency: "HTG", minQty: 6, unitLabel: "pièce", colors: ["Blanc"], sizes: [], colorLabel: "Couleur", sizeLabel: "Taille", colorsRequired: false, sizesRequired: false, placements: ["FRONT"], pricingMode: "PER_PIECE", supportsLogo: true, supportsText: true, supportsArtwork: true, artworkRequired: false, customSize: null, priceTiers: [{ minQty: 6, unitPrice: "450.00" }, { minQty: 50, unitPrice: "380.00" }], updatedAt: now() },
      { id: "prod_tee", slug: "t-shirt", name: "T-shirt brodé", description: "T-shirt coton.", status: "ACTIVE", category: { id: "cat_2", slug: "vetements", name: "Vêtements" }, basePrice: "650.00", compareAtPrice: null, currency: "HTG", minQty: 10, unitLabel: "pièce", colors: ["Rouge", "Noir"], sizes: ["S", "M", "L"], colorLabel: "Couleur", sizeLabel: "Taille", colorsRequired: true, sizesRequired: true, placements: ["FRONT", "BACK"], pricingMode: "PER_PIECE", supportsLogo: true, supportsText: true, supportsArtwork: true, artworkRequired: false, customSize: null, priceTiers: [{ minQty: 10, unitPrice: "650.00" }], updatedAt: now() },
      { id: "prod_banner", slug: "banderole-pvc", name: "Banderole PVC", description: null, status: "DRAFT", category: { id: "cat_3", slug: "grand-format", name: "Grand format" }, basePrice: "1200.00", compareAtPrice: null, currency: "HTG", minQty: 1, unitLabel: "m²", colors: [], sizes: [], colorLabel: "Couleur", sizeLabel: "Taille", colorsRequired: false, sizesRequired: false, placements: ["FRONT"], pricingMode: "PER_AREA", supportsLogo: true, supportsText: true, supportsArtwork: true, artworkRequired: true, customSize: null, priceTiers: [{ minQty: 1, unitPrice: "1200.00" }], updatedAt: now() },
    ],
  };
  const addUser = (email, fullName, staffRole, extra = {}) => S.users.push({ id: id("usr"), email, fullName, staffRole, status: "ACTIVE", isStaff: staffRole !== null, password: TEST_PASSWORD, mustChangePassword: false, lastLoginAt: null, createdAt: now(), ...extra });
  addUser("superadmin@impactpro.test", "Super Admin", "SUPER_ADMIN");
  addUser("admin@impactpro.test", "Alice Admin", "ADMIN");
  addUser("sales@impactpro.test", "Sam Ventes", "SALES");
  addUser("accounting@impactpro.test", "Clara Compta", "ACCOUNTING");
  addUser("production@impactpro.test", "Paul Production", "PRODUCTION");
  addUser("support@impactpro.test", "Sofia Support", "SUPPORT");
  addUser("temp@impactpro.test", "Tom Temporaire", "SALES", { mustChangePassword: true });
  addUser("client@example.com", "Cliente Boutique", null);

  const c1 = { id: id("cus"), email: "jean@example.com", fullName: "Jean Baptiste", company: "Boutique Soleil", phone: "+509 3700 0001", address: "12 rue Capois", city: "Port-au-Prince", country: "HT", taxId: null, notes: null, userId: null, source: "ORDER", createdAt: now() };
  const c2 = { id: id("cus"), email: "marie@example.com", fullName: "Marie Louis", company: null, phone: "+509 3700 0002", address: null, city: "Cap-Haïtien", country: "HT", taxId: null, notes: null, userId: null, source: "ADMIN", createdAt: now() };
  S.customers.push(c1, c2);

  const mkOrder = (ref, customer, status, items) => {
    const o = {
      id: id("ord"), reference: ref, status, currency: "HTG", customerId: customer.id, customerName: customer.fullName, company: customer.company, email: customer.email, phone: customer.phone ?? "", city: customer.city, address: customer.address, deliveryMethod: "DELIVERY", notes: "Livraison avant vendredi.", createdAt: now(),
      items: items.map((it, i) => ({ id: id("itm"), lineNo: i + 1, productId: it.productId, productSlug: it.slug, productName: it.name, quantity: it.qty, unitPrice: it.price, lineTotal: fx(it.qty * Number(it.price)), color: it.color ?? null, size: it.size ?? null, widthCm: null, heightCm: null, areaM2: null, notes: null, elements: [{ placement: "FRONT", kind: "LOGO", logoUrl: "/api/v1/uploads/logos/logo.png", originalName: "logo.png" }, { placement: "FRONT", kind: "TEXT", text: "Boutique Soleil", font: "Fredoka", color: "#0A716A" }], previews: [{ placement: "FRONT", url: "/api/v1/uploads/previews/preview.png" }] })),
      events: [{ id: id("evt"), type: "STATUS", message: "Commande reçue", data: null, actor: null, createdAt: now() }],
    };
    o.subtotal = fx(o.items.reduce((s, i) => s + Number(i.lineTotal), 0));
    S.orders.push(o);
    return o;
  };
  mkOrder("IP-2026-000001", c1, "RECEIVED", [{ productId: "prod_mug", slug: "tasse-sublimation", name: "Tasse sublimation", qty: 24, price: "450.00", color: "Blanc" }, { productId: "prod_tee", slug: "t-shirt", name: "T-shirt brodé", qty: 12, price: "650.00", color: "Rouge", size: "M" }]);
  mkOrder("IP-2026-000002", c2, "APPROVED", [{ productId: "prod_tee", slug: "t-shirt", name: "T-shirt brodé", qty: 30, price: "650.00", color: "Noir", size: "L" }]);
}
reset();

// ---------- helpers ----------
const summary = (d) => ({ id: d.id, type: d.type, number: d.number, status: d.status, isOverdue: isOverdue(d), currency: d.currency, total: d.total, balance: d.balance, issueDate: d.issueDate, customerName: d.customer.name, createdAt: d.createdAt });
function isOverdue(d) {
  return Boolean(d.dueDate && d.dueDate < day() && Number(d.balance) > 0 && ["SENT", "PARTIALLY_PAID"].includes(d.status));
}
const orderItem = (o) => ({ id: o.id, reference: o.reference, status: o.status, currency: o.currency, subtotal: o.subtotal, customerName: o.customerName, company: o.company, email: o.email, phone: o.phone, itemCount: o.items.length, createdAt: o.createdAt, customerId: o.customerId, hasDocuments: S.documents.some((d) => d.orderId === o.id) });
function balances(customerId) {
  const m = {};
  for (const d of S.documents.filter((x) => x.customerId === customerId && x.type === "INVOICE" && !["DRAFT", "VOID"].includes(x.status))) {
    const b = (m[d.currency] ??= { currency: d.currency, billed: 0, paid: 0 });
    b.billed += Number(d.total);
    b.paid += Number(d.amountPaid);
  }
  return Object.values(m).map((b) => ({ currency: b.currency, billed: fx(b.billed), paid: fx(b.paid), due: fx(b.billed - b.paid) }));
}
function customerItem(c) {
  const os = S.orders.filter((o) => o.customerId === c.id);
  return { ...c, ordersCount: os.length, lastOrderAt: os.length ? os[os.length - 1].createdAt : null, balances: balances(c.id) };
}
function audit(user, action, entityType, entityId, metadata) {
  S.audit.unshift({ id: id("aud"), action, entityType, entityId, metadata: metadata ?? null, actor: user ? { id: user.id, name: user.fullName } : null, ipAddress: "127.0.0.1", createdAt: now() });
}
const who = (u) => ({ id: u.id, name: u.fullName });
function docEvent(d, user, type, message) {
  d.events.unshift({ id: id("dev"), type, message, actor: user ? who(user) : null, createdAt: now() });
}
function orderEvent(o, user, type, message) {
  o.events.unshift({ id: id("evt"), type, message, data: null, actor: user ? who(user) : null, createdAt: now() });
}
function nextNumber(type) {
  const year = new Date().getFullYear();
  const key = `${type}-${year}`;
  S.counters[key] = (S.counters[key] ?? 0) + 1;
  const prefix = S.settings.prefixes[type.toLowerCase()];
  return `${prefix}-${year}-${String(S.counters[key]).padStart(4, "0")}`;
}
function fullDoc(d) {
  const o = d.orderId ? S.orders.find((x) => x.id === d.orderId) : null;
  const parent = d.parentId ? S.documents.find((x) => x.id === d.parentId) : null;
  return { ...d, isOverdue: isOverdue(d), orderReference: o?.reference ?? null, parentNumber: parent?.number ?? null, children: S.documents.filter((x) => x.parentId === d.id).map((x) => ({ id: x.id, type: x.type, number: x.number })), publicUrl: d.publicToken ? `/api/v1/public/documents/${d.publicToken}` : null };
}
const needsPerm = (type, write) => (type === "INVOICE" ? (write ? "invoices.write" : "invoices.read") : write ? "quotes.write" : "quotes.read");

function newDocument(user, body) {
  const type = body.type;
  const customerSrc = body.customerId ? S.customers.find((c) => c.id === body.customerId) : null;
  const order = body.orderId ? S.orders.find((o) => o.id === body.orderId) : null;
  const cust = customerSrc ?? (order ? S.customers.find((c) => c.id === order.customerId) : null);
  const customer = body.customer ?? (cust ? { name: cust.fullName, company: cust.company, email: cust.email, phone: cust.phone, address: cust.address, city: cust.city, country: cust.country, taxId: cust.taxId } : null);
  if (!customer?.email) return { error: [422, "VALIDATION_ERROR", "Client requis.", [{ field: "customer", messages: ["Client requis."] }]] };
  let lines = body.lines;
  if (!lines && order) lines = order.items.map((it, i) => ({ position: i + 1, description: `${it.productName}${it.color ? ` — ${it.color}` : ""}${it.size ? ` / ${it.size}` : ""}`, productId: it.productId, quantity: it.quantity, unit: "pièce", unitPrice: it.unitPrice, discountPercent: 0 }));
  const d = {
    id: id("doc"), type, number: nextNumber(type), status: "DRAFT", currency: body.currency ?? order?.currency ?? S.settings.defaultCurrency,
    issueDate: body.issueDate ?? day(), dueDate: body.dueDate ?? (type === "INVOICE" ? day(S.settings.paymentTermsDays) : null), validUntil: body.validUntil ?? (type === "QUOTE" ? day(S.settings.quoteValidityDays) : null),
    customerId: cust?.id ?? null, customer, orderId: order?.id ?? null, parentId: body.parentId ?? null,
    lines: (lines ?? []).map((l, i) => ({ id: id("lin"), position: i + 1, description: l.description, sku: l.sku ?? null, productId: l.productId ?? null, quantity: String(l.quantity), unit: l.unit ?? null, unitPrice: String(l.unitPrice), discountPercent: fx(Number(l.discountPercent ?? 0)) })),
    discountAmount: fx(Number(body.discountAmount ?? 0)), shippingAmount: fx(Number(body.shippingAmount ?? 0)), taxRate: fx(Number(body.taxRate ?? S.settings.defaultTaxRate)),
    notes: body.notes ?? null, internalNotes: body.internalNotes ?? null, terms: body.terms ?? S.settings.defaultTerms, paymentInstructions: body.paymentInstructions ?? S.settings.paymentInstructions,
    sentAt: null, sentTo: [], acceptedAt: null, publicToken: null, createdBy: who(user), createdAt: now(), updatedAt: now(), payments: [], events: [],
  };
  totals(d);
  docEvent(d, user, "CREATED", `${d.number} créé`);
  S.documents.push(d);
  if (order) orderEvent(order, user, "DOCUMENT", `${d.number} créé depuis la commande`);
  audit(user, "document.create", "Document", d.id, { number: d.number });
  return { doc: d };
}

// ---------- tiny PDF ----------
function pdfBytes(text) {
  const stream = `BT /F1 18 Tf 60 760 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

// ---------- server ----------
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};
const ok = (res, data, meta, headers) => send(res, 200, meta ? { data, meta } : { data }, headers);
const fail = (res, status, code, message, details) => send(res, status, { error: { code, message, ...(details ? { details } : {}) } });

function paginate(items, q) {
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const pageSize = Math.min(100, Number(q.get("pageSize") ?? 20));
  const total = items.length;
  return [items.slice((page - 1) * pageSize, page * pageSize), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }];
}
const parseCookies = (h) => Object.fromEntries((h ?? "").split(/;\s*/).filter(Boolean).map((c) => [c.slice(0, c.indexOf("=")), decodeURIComponent(c.slice(c.indexOf("=") + 1))]));
const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        resolve({});
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  const q = url.searchParams;
  const method = req.method;
  try {
    if (p === "/__reset" && method === "POST") {
      reset();
      return ok(res, { reset: true });
    }
    if (p === "/__mail" && method === "POST") {
      S.mail = (await readBody(req)).configured === true;
      return ok(res, { configured: S.mail });
    }
    if (p === "/api/v1/health") return ok(res, { status: "ok" });
    if (p.startsWith("/api/v1/uploads/")) {
      res.writeHead(200, { "Content-Type": "image/png" });
      return res.end(PNG);
    }
    if (!p.startsWith("/api/v1/")) return fail(res, 404, "NOT_FOUND", "Introuvable");
    const route = p.slice(7);
    const cookies = parseCookies(req.headers.cookie);
    const user = S.sessions.get(cookies.ip_session) ?? null;
    const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) ? await readBody(req) : {};

    // --- auth ---
    if (route === "/auth/login" && method === "POST") {
      const u = S.users.find((x) => x.email === String(body.email).toLowerCase());
      if (!u || u.password !== body.password || u.status !== "ACTIVE") return fail(res, 401, "INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect.");
      const sid = randomBytes(16).toString("hex");
      S.sessions.set(sid, u);
      u.lastLoginAt = now();
      audit(u, "auth.login", "User", u.id);
      const csrf = randomBytes(12).toString("hex");
      return ok(res, { id: u.id }, undefined, { "Set-Cookie": [`ip_session=${sid}; Path=/; HttpOnly; SameSite=Lax`, `ip_csrf=${csrf}; Path=/; SameSite=Lax`] });
    }
    if (route === "/auth/logout" && method === "POST") {
      S.sessions.delete(cookies.ip_session);
      return ok(res, { ok: true }, undefined, { "Set-Cookie": ["ip_session=; Path=/; Max-Age=0", "ip_csrf=; Path=/; Max-Age=0"] });
    }
    if (!user) return fail(res, 401, "UNAUTHENTICATED", "Connexion requise.");
    if (method !== "GET" && (!req.headers["x-csrf-token"] || req.headers["x-csrf-token"] !== cookies.ip_csrf)) return fail(res, 403, "CSRF", "Jeton CSRF invalide.");
    if (route === "/auth/change-password" && method === "POST") {
      if (user.password !== body.currentPassword) return fail(res, 401, "INVALID_CREDENTIALS", "Mot de passe actuel incorrect.");
      if (String(body.newPassword ?? "").length < 12) return fail(res, 422, "VALIDATION_ERROR", "Validation", [{ field: "newPassword", messages: ["12 caractères minimum."] }]);
      user.password = body.newPassword;
      user.mustChangePassword = false;
      return ok(res, { ok: true });
    }
    if (!user.isStaff) return fail(res, 403, "FORBIDDEN", "Accès réservé à l'équipe.");
    const perms = ROLE_PERMS[user.staffRole];
    const need = (perm) => {
      if (perms.includes(perm)) return true;
      fail(res, 403, "FORBIDDEN", "Permission manquante.");
      return false;
    };

    if (route === "/admin/me") return ok(res, { id: user.id, email: user.email, fullName: user.fullName, staffRole: user.staffRole, permissions: perms, mustChangePassword: user.mustChangePassword });

    // --- dashboard ---
    if (route === "/admin/dashboard") {
      if (!need("dashboard.read")) return;
      const byStatus = {};
      for (const o of S.orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      const inv = S.documents.filter((d) => d.type === "INVOICE" && !["DRAFT", "VOID"].includes(d.status));
      const cur = [...new Set(inv.map((d) => d.currency))];
      return ok(res, {
        generatedAt: now(),
        orders: { total: S.orders.length, byStatus, last7d: S.orders.length, last30d: S.orders.length },
        revenue: cur.map((c) => ({ currency: c, paid7d: fx(inv.filter((d) => d.currency === c).reduce((s, d) => s + Number(d.amountPaid), 0)), paid30d: fx(inv.filter((d) => d.currency === c).reduce((s, d) => s + Number(d.amountPaid), 0)), outstanding: fx(inv.filter((d) => d.currency === c).reduce((s, d) => s + Number(d.balance), 0)), overdue: fx(inv.filter((d) => d.currency === c && isOverdue(d)).reduce((s, d) => s + Number(d.balance), 0)) })),
        customers: { total: S.customers.length, new30d: S.customers.length },
        documents: { draftQuotes: S.documents.filter((d) => d.type === "QUOTE" && d.status === "DRAFT").length, openQuotes: S.documents.filter((d) => d.type === "QUOTE" && d.status === "SENT").length, unpaidInvoices: inv.filter((d) => Number(d.balance) > 0).length, overdueInvoices: inv.filter(isOverdue).length },
        mail: perms.includes("mail.read") && S.mail ? { unread: 0 } : null,
        recentOrders: S.orders.slice(-5).reverse().map(orderItem),
        topProducts: [{ productName: "Tasse sublimation", quantity: 24, orders: 1 }, { productName: "T-shirt brodé", quantity: 42, orders: 2 }],
        activity: S.audit.slice(0, 10),
      });
    }

    // --- orders ---
    if (route === "/admin/orders" && method === "GET") {
      if (!need("orders.read")) return;
      const term = (q.get("q") ?? "").toLowerCase();
      let list = S.orders.filter((o) => (!q.get("status") || o.status === q.get("status")) && (!term || [o.reference, o.customerName, o.company, o.email, o.phone].some((v) => String(v ?? "").toLowerCase().includes(term))));
      list = [...list].reverse();
      const [items, meta] = paginate(list.map(orderItem), q);
      return ok(res, items, meta);
    }
    let m = route.match(/^\/admin\/orders\/([^/]+)(?:\/(status|notes))?$/);
    if (m) {
      const o = S.orders.find((x) => x.id === m[1]);
      if (!need(method === "GET" ? "orders.read" : "orders.write")) return;
      if (!o) return fail(res, 404, "NOT_FOUND", "Commande introuvable.");
      if (!m[2] && method === "GET") {
        const c = S.customers.find((x) => x.id === o.customerId);
        return ok(res, { ...orderItem(o), city: o.city, address: o.address, deliveryMethod: o.deliveryMethod, notes: o.notes, customer: c ? { id: c.id, email: c.email, fullName: c.fullName, company: c.company, phone: c.phone } : null, items: o.items, documents: S.documents.filter((d) => d.orderId === o.id).map(summary), events: o.events });
      }
      if (m[2] === "status") {
        const to = body.status;
        const from = o.status;
        const fi = ORDER_FLOW.indexOf(from);
        const allowed = (to === "CANCELLED" && from !== "DELIVERED" && from !== "CANCELLED") || (from === "CANCELLED" && to === "RECEIVED" && ["SUPER_ADMIN", "ADMIN"].includes(user.staffRole)) || (fi >= 0 && ORDER_FLOW.indexOf(to) > fi);
        if (!allowed) return fail(res, 409, "INVALID_TRANSITION", `Transition ${from} → ${to} non autorisée.`);
        o.status = to;
        orderEvent(o, user, "STATUS", `Statut : ${from} → ${to}${body.note ? ` — ${body.note}` : ""}`);
        audit(user, "order.status_change", "CustomOrder", o.id, { from, to });
        return ok(res, orderItem(o));
      }
      if (m[2] === "notes") {
        if (!String(body.message ?? "").trim()) return fail(res, 422, "VALIDATION_ERROR", "Validation", [{ field: "message", messages: ["Message requis."] }]);
        orderEvent(o, user, "NOTE", body.message);
        return ok(res, { ok: true });
      }
    }

    // --- customers ---
    if (route === "/admin/customers" && method === "GET") {
      if (!need("customers.read")) return;
      const term = (q.get("q") ?? "").toLowerCase();
      const list = S.customers.filter((c) => !term || [c.fullName, c.company, c.email, c.phone].some((v) => String(v ?? "").toLowerCase().includes(term))).map(customerItem);
      const [items, meta] = paginate(list, q);
      return ok(res, items, meta);
    }
    if (route === "/admin/customers" && method === "POST") {
      if (!need("customers.write")) return;
      if (!body.email || !body.fullName) return fail(res, 422, "VALIDATION_ERROR", "Validation", [{ field: !body.email ? "email" : "fullName", messages: ["Champ requis."] }]);
      if (S.customers.some((c) => c.email === String(body.email).toLowerCase())) return fail(res, 409, "CONFLICT", "Un client avec cet e-mail existe déjà.");
      const c = { id: id("cus"), source: "ADMIN", createdAt: now(), userId: null, country: "HT", ...body, email: String(body.email).toLowerCase() };
      S.customers.push(c);
      return send(res, 201, { data: customerItem(c) });
    }
    m = route.match(/^\/admin\/customers\/([^/]+)$/);
    if (m) {
      const c = S.customers.find((x) => x.id === m[1]);
      if (!need(method === "GET" ? "customers.read" : "customers.write")) return;
      if (!c) return fail(res, 404, "NOT_FOUND", "Client introuvable.");
      if (method === "PATCH") {
        if ("email" in body || body.country === null) return fail(res, 422, "VALIDATION_ERROR", "Validation failed", [{ field: "email" in body ? "email" : "country", messages: ["property email should not exist"] }]);
        Object.assign(c, body);
      }
      return ok(res, { ...customerItem(c), orders: S.orders.filter((o) => o.customerId === c.id).map(orderItem), documents: S.documents.filter((d) => d.customerId === c.id).map(summary) });
    }

    // --- products ---
    if (route === "/admin/products" && method === "GET") {
      if (!need("products.read")) return;
      const term = (q.get("q") ?? "").toLowerCase();
      const list = S.products.filter((x) => (!q.get("status") || x.status === q.get("status")) && (!term || x.name.toLowerCase().includes(term)));
      const [items, meta] = paginate(list, q);
      return ok(res, items, meta);
    }
    m = route.match(/^\/admin\/products\/([^/]+)$/);
    if (m) {
      const pr = S.products.find((x) => x.id === m[1]);
      if (!need(method === "GET" ? "products.read" : "products.write")) return;
      if (!pr) return fail(res, 404, "NOT_FOUND", "Produit introuvable.");
      if (method === "PATCH") {
        if (body.priceTiers) {
          const t = body.priceTiers;
          if (!t.length || t.some((x, i) => Number(x.unitPrice) <= 0 || (i > 0 && x.minQty <= t[i - 1].minQty))) return fail(res, 422, "VALIDATION_ERROR", "Validation", [{ field: "priceTiers", messages: ["Paliers invalides : quantités strictement croissantes et prix > 0."] }]);
        }
        Object.assign(pr, body, { updatedAt: now() });
        audit(user, "product.update", "Product", pr.id);
      }
      return ok(res, pr);
    }

    // --- documents ---
    if (route === "/admin/documents/export.csv") {
      if (!need("invoices.read") && !perms.includes("quotes.read")) return;
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="documents.csv"' });
      return res.end("﻿numero,client,total\n" + S.documents.filter((d) => !q.get("type") || d.type === q.get("type")).map((d) => `${d.number},${d.customer.name},${d.total}`).join("\n"));
    }
    if (route === "/admin/documents" && method === "GET") {
      const type = q.get("type");
      if (!need(needsPerm(type ?? "QUOTE", false))) return;
      const term = (q.get("q") ?? "").toLowerCase();
      const list = S.documents.filter((d) => (!type || d.type === type) && (!q.get("status") || d.status === q.get("status")) && (!q.get("customerId") || d.customerId === q.get("customerId")) && (q.get("overdue") !== "true" || isOverdue(d)) && (!term || d.number.toLowerCase().includes(term) || d.customer.name.toLowerCase().includes(term)));
      const [items, meta] = paginate([...list].reverse().map(summary), q);
      delete meta.totalPages; // the real documents endpoint omits it
      return ok(res, items, meta);
    }
    if (route === "/admin/documents" && method === "POST") {
      if (!need(needsPerm(body.type, true))) return;
      const r = newDocument(user, body);
      if (r.error) return fail(res, ...r.error);
      return send(res, 201, { data: fullDoc(r.doc) });
    }
    m = route.match(/^\/admin\/documents\/([^/]+)(?:\/(pdf|convert|duplicate|void|status|send|payments)(?:\/([^/]+)\/void)?)?$/);
    if (m) {
      const d = S.documents.find((x) => x.id === m[1]);
      if (!d) return fail(res, 404, "NOT_FOUND", "Document introuvable.");
      const write = method !== "GET";
      if (!need(needsPerm(d.type, write))) return;
      const sub = m[2];
      if (!sub) {
        if (method === "GET") return ok(res, fullDoc(d));
        if (method === "DELETE") {
          if (d.status !== "DRAFT") return fail(res, 409, "CONFLICT", "Seul un brouillon peut être supprimé.");
          S.documents.splice(S.documents.indexOf(d), 1);
          return ok(res, { deleted: true });
        }
        if (method === "PATCH") {
          const bad = [...Object.keys(body).filter((k) => k === "type"), ...(body.lines ?? []).flatMap((l) => Object.keys(l).filter((k) => k === "position"))];
          if (bad.length) return fail(res, 422, "VALIDATION_ERROR", "Validation failed", bad.map((f) => ({ field: f, messages: [`property ${f} should not exist`] })));
          const locked = d.status !== "DRAFT";
          if (d.status === "VOID") return fail(res, 409, "DOCUMENT_LOCKED", "A voided document cannot be edited");
          if (locked && d.type === "INVOICE" && Object.keys(body).some((k) => k !== "internalNotes")) return fail(res, 409, "DOCUMENT_LOCKED", "A sent facture can only change: internalNotes", Object.keys(body).filter((k) => k !== "internalNotes").map((f) => ({ field: f, messages: ["locked after sending"] })));
          const keys = locked ? ["notes", "dueDate", "validUntil", "terms", "internalNotes"] : ["customerId", "customer", "currency", "issueDate", "dueDate", "validUntil", "lines", "taxRate", "discountAmount", "shippingAmount", "notes", "internalNotes", "terms", "paymentInstructions"];
          for (const k of keys) if (k in body) d[k] = body[k];
          if (!locked && body.lines) d.lines = body.lines.map((l, i) => ({ id: id("lin"), position: i + 1, description: l.description, sku: l.sku ?? null, productId: l.productId ?? null, quantity: String(l.quantity), unit: l.unit ?? null, unitPrice: String(l.unitPrice), discountPercent: fx(Number(l.discountPercent ?? 0)) }));
          if (!locked && body.customerId) {
            const c = S.customers.find((x) => x.id === body.customerId);
            if (c) d.customer = { name: c.fullName, company: c.company, email: c.email, phone: c.phone, address: c.address, city: c.city, country: c.country, taxId: c.taxId };
          }
          d.taxRate = fx(Number(d.taxRate));
          totals(d);
          d.updatedAt = now();
          return ok(res, fullDoc(d));
        }
      }
      if (sub === "pdf") {
        res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${d.number}.pdf"` });
        return res.end(pdfBytes(`${d.number} - ${d.customer.name} - ${d.total} ${d.currency}`));
      }
      if (sub === "convert") {
        const to = body.to;
        const okPair = (d.type === "QUOTE" && ["PROFORMA", "INVOICE"].includes(to)) || (d.type === "PROFORMA" && to === "INVOICE");
        if (!okPair || d.status === "VOID") return fail(res, 409, "INVALID_TRANSITION", "Conversion non autorisée.");
        const r = newDocument(user, { type: to, customerId: d.customerId, customer: d.customer, orderId: d.orderId, parentId: d.id, currency: d.currency, lines: d.lines, taxRate: d.taxRate, discountAmount: d.discountAmount, shippingAmount: d.shippingAmount, notes: d.notes });
        if (d.status === "SENT") {
          d.status = "ACCEPTED";
          d.acceptedAt = now();
        }
        docEvent(d, user, "CONVERTED", `Converti en ${r.doc.number}`);
        return send(res, 201, { data: fullDoc(r.doc) });
      }
      if (sub === "duplicate") {
        const r = newDocument(user, { type: d.type, customerId: d.customerId, customer: d.customer, orderId: d.orderId, currency: d.currency, lines: d.lines, taxRate: d.taxRate, discountAmount: d.discountAmount, shippingAmount: d.shippingAmount, notes: d.notes });
        return send(res, 201, { data: fullDoc(r.doc) });
      }
      if (sub === "void" && !m[3]) {
        if (String(body.reason ?? "").trim().length < 3) return fail(res, 422, "VALIDATION_ERROR", "Validation failed", [{ field: "reason", messages: ["reason must be longer than or equal to 3 characters"] }]);
        if (d.status === "DRAFT" || d.status === "VOID") return fail(res, 409, "INVALID_TRANSITION", "Annulation impossible.");
        d.status = "VOID";
        docEvent(d, user, "VOID", `Annulé : ${body.reason}`);
        audit(user, "document.void", "Document", d.id);
        return ok(res, fullDoc(d));
      }
      if (sub === "status") {
        if (d.type === "INVOICE" || !["ACCEPTED", "REJECTED"].includes(body.status)) return fail(res, 409, "INVALID_TRANSITION", "Statut non autorisé.");
        d.status = body.status;
        docEvent(d, user, "STATUS", `Marqué ${body.status === "ACCEPTED" ? "accepté" : "refusé"}`);
        return ok(res, fullDoc(d));
      }
      if (sub === "send") {
        if (!body.markAsSentOnly && !S.mail) return fail(res, 503, "MAIL_NOT_CONFIGURED", "La messagerie n'est pas configurée.");
        if (d.status === "VOID") return fail(res, 409, "INVALID_TRANSITION", "Document annulé.");
        if (d.status === "DRAFT") d.status = "SENT";
        d.publicToken ??= randomBytes(16).toString("base64url");
        d.sentAt = now();
        d.sentTo = body.markAsSentOnly ? [d.customer.email] : (body.to ?? [d.customer.email]);
        docEvent(d, user, "SENT", body.markAsSentOnly ? "Marqué comme envoyé" : `Envoyé à ${d.sentTo.join(", ")}`);
        if (d.orderId) orderEvent(S.orders.find((o) => o.id === d.orderId), user, "EMAIL", `${d.number} envoyé`);
        audit(user, "document.send", "Document", d.id);
        return ok(res, fullDoc(d));
      }
      if (sub === "payments") {
        if (!need("payments.write")) return;
        if (m[3]) {
          const pay = d.payments.find((x) => x.id === m[3]);
          if (!pay || pay.voidedAt) return fail(res, 404, "NOT_FOUND", "Paiement introuvable.");
          pay.voidedAt = now();
          pay.voidReason = body.reason ?? "";
        } else {
          const amount = Number(body.amount);
          if (d.type !== "INVOICE" || ["DRAFT", "VOID", "PAID"].includes(d.status)) return fail(res, 409, "CONFLICT", "Paiement impossible sur ce document.");
          if (!(amount > 0)) return fail(res, 422, "VALIDATION_ERROR", "Validation", [{ field: "amount", messages: ["Montant invalide."] }]);
          if (amount > Number(d.balance) + 0.0001) return fail(res, 422, "OVERPAYMENT", `Amount exceeds the balance due (${d.balance} ${d.currency})`, [{ field: "amount", messages: ["exceeds the balance due"] }]);
          d.payments.push({ id: id("pay"), amount: fx(amount), currency: d.currency, method: body.method ?? "OTHER", paidAt: body.paidAt ?? day(), reference: body.reference ?? null, notes: body.notes ?? null, voidedAt: null, voidReason: null, recordedBy: who(user) });
          audit(user, "payment.record", "Payment", d.id, { amount: fx(amount) });
        }
        totals(d);
        const paid = Number(d.amountPaid);
        d.status = paid <= 0 ? "SENT" : Number(d.balance) <= 0 ? "PAID" : "PARTIALLY_PAID";
        docEvent(d, user, "PAYMENT", m[3] ? "Paiement annulé" : `Paiement de ${fx(Number(body.amount))} ${d.currency} enregistré`);
        return send(res, 201, { data: fullDoc(d) });
      }
    }

    // --- billing settings ---
    if (route === "/admin/billing/settings") {
      if (!need("billing.settings")) return;
      if (method === "PUT") {
        const errs = [];
        for (const f of ["legalName", "address", "city", "country", "phone", "email"]) if (!body[f] || String(body[f]).length < 1) errs.push({ field: f, messages: [`${f} must be longer than or equal to 1 characters`] });
        if (!["HTG", "USD"].includes(body.defaultCurrency)) errs.push({ field: "defaultCurrency", messages: ["defaultCurrency must be one of the following values: HTG, USD"] });
        if (!(Number(body.defaultTaxRate) >= 0 && Number(body.defaultTaxRate) <= 100)) errs.push({ field: "defaultTaxRate", messages: ["defaultTaxRate must be between 0 and 100"] });
        if (errs.length) return fail(res, 422, "VALIDATION_ERROR", "Validation failed", errs);
        S.settings = { ...S.settings, ...body, defaultTaxRate: fx(Number(body.defaultTaxRate)) };
        audit(user, "billing.settings.update", "BillingSettings", "singleton");
      }
      return ok(res, S.settings);
    }

    // --- reports ---
    if (route === "/admin/reports/revenue") {
      if (!need("reports.read")) return;
      const rows = {};
      for (const d of S.documents.filter((x) => x.type === "INVOICE" && !["DRAFT", "VOID"].includes(x.status))) {
        const k = `${d.issueDate.slice(0, 7)}|${d.currency}`;
        rows[k] ??= { period: d.issueDate.slice(0, 7), currency: d.currency, invoiced: 0, paid: 0 };
        rows[k].invoiced += Number(d.total);
        rows[k].paid += Number(d.amountPaid);
      }
      return ok(res, Object.values(rows).map((r) => ({ ...r, invoiced: fx(r.invoiced), paid: fx(r.paid) })));
    }
    if (route === "/admin/reports/aging") {
      if (!need("reports.read")) return;
      const rows = {};
      for (const d of S.documents.filter((x) => x.type === "INVOICE" && ["SENT", "PARTIALLY_PAID"].includes(x.status))) {
        const r = (rows[d.currency] ??= { currency: d.currency, current: 0, d1_30: 0, d31_60: 0, d61_plus: 0, total: 0 });
        const late = d.dueDate ? Math.floor((Date.now() - new Date(d.dueDate).getTime()) / 86400000) : 0;
        const b = Number(d.balance);
        r[late <= 0 ? "current" : late <= 30 ? "d1_30" : late <= 60 ? "d31_60" : "d61_plus"] += b;
        r.total += b;
      }
      return ok(res, Object.values(rows).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? fx(v) : v]))));
    }

    // --- users ---
    if (route.startsWith("/admin/users")) {
      if (!need("users.manage")) return;
      const pub = (u) => ({ id: u.id, email: u.email, fullName: u.fullName, staffRole: u.staffRole, status: u.status, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt });
      const tempPw = () => `Tmp-${randomBytes(9).toString("base64url")}`;
      if (route === "/admin/users" && method === "GET") return ok(res, S.users.filter((u) => u.isStaff).map(pub));
      if (route === "/admin/users" && method === "POST") {
        if (S.users.some((u) => u.email === String(body.email).toLowerCase())) return fail(res, 409, "CONFLICT", "Cette adresse existe déjà.");
        if (body.staffRole === "SUPER_ADMIN" && user.staffRole !== "SUPER_ADMIN") return fail(res, 403, "FORBIDDEN", "Seul un super administrateur peut créer un super administrateur.");
        const password = tempPw();
        const u = { id: id("usr"), email: String(body.email).toLowerCase(), fullName: body.fullName, staffRole: body.staffRole, status: "ACTIVE", isStaff: true, password, mustChangePassword: true, lastLoginAt: null, createdAt: now() };
        S.users.push(u);
        audit(user, "staff.create", "User", u.id);
        return send(res, 201, { data: { ...pub(u), temporaryPassword: password } });
      }
      m = route.match(/^\/admin\/users\/([^/]+)(\/reset-password)?$/);
      if (m) {
        const u = S.users.find((x) => x.id === m[1]);
        if (!u) return fail(res, 404, "NOT_FOUND", "Utilisateur introuvable.");
        if (m[2]) {
          u.password = tempPw();
          u.mustChangePassword = true;
          return ok(res, { temporaryPassword: u.password });
        }
        if (u.id === user.id) return fail(res, 409, "CONFLICT", "Vous ne pouvez pas modifier votre propre compte ici.");
        if ((u.staffRole === "SUPER_ADMIN" || body.staffRole === "SUPER_ADMIN") && user.staffRole !== "SUPER_ADMIN") return fail(res, 403, "FORBIDDEN", "Réservé aux super administrateurs.");
        Object.assign(u, Object.fromEntries(["staffRole", "status", "fullName"].filter((k) => k in body).map((k) => [k, body[k]])));
        return ok(res, pub(u));
      }
    }

    // --- audit ---
    if (route === "/admin/audit-logs") {
      if (!need("audit.read")) return;
      const list = S.audit.filter((a) => (!q.get("action") || a.action === q.get("action")) && (!q.get("entityType") || a.entityType === q.get("entityType")));
      const [items, meta] = paginate(list, q);
      return ok(res, items, meta);
    }

    // --- mail ---
    if (route === "/admin/mail/status") {
      if (!need("mail.read")) return;
      if (!S.mail) return fail(res, 404, "NOT_FOUND", "Cannot GET /api/v1/admin/mail/status"); // stage-2 module absent
      return ok(res, { configured: true, provider: "resend", fromAddress: "contact@example.com", lastSyncAt: now(), unread: 0 });
    }

    return fail(res, 404, "NOT_FOUND", `Route inconnue : ${method} ${route}`);
  } catch (e) {
    console.error(e);
    return fail(res, 500, "INTERNAL", "Erreur interne du mock");
  }
});

server.listen(PORT, () => console.log(`mock admin API on :${PORT}`));
