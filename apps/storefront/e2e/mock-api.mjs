/**
 * TEST-ONLY mock of the Impact Pro API, implementing docs/customizer-v2-contract.md (catalog caps, uploads,
 * element-based custom orders with the server-side pricing + validation rules). It exists so the storefront e2e suite
 * is deterministic and can run before / without the real backend. Set E2E_REAL_API=1 to run the suite against a real API.
 *
 * Usage: node e2e/mock-api.mjs [port]   (default 4100)
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.argv[2] || process.env.MOCK_API_PORT || 4100);
const ZONE_LABELS = { FRONT: "Devant", BACK: "Dos", CHEST_LEFT: "Cœur (poitrine gauche)", SLEEVE: "Manche", WRAP: "Tour complet", FULL: "Pleine surface", SIDE: "Côté", TOP: "Dessus / toit" };
const FONTS = ["fredoka", "inter", "pacifico", "bebas-neue", "playfair", "montserrat", "dancing-script", "oswald"];

const base = (o) => ({
  description: null,
  basePrice: "100.00",
  compareAtPrice: null,
  currency: "HTG",
  colors: [],
  sizes: [],
  colorLabel: "Couleur",
  sizeLabel: "Taille",
  colorsRequired: true,
  sizesRequired: true,
  images: [],
  pricingMode: "PER_PIECE",
  supportsLogo: true,
  supportsText: true,
  supportsArtwork: false,
  artworkRequired: false,
  customSize: null,
  ...o,
  zones: o.placements.map((placement) => ({ placement, label: ZONE_LABELS[placement], maxElements: 10 })),
});

const PRODUCTS = [
  base({
    slug: "tasse-ceramique-11oz",
    name: "Tasse céramique 11 oz",
    description: "Tasse blanche 11 oz, impression sublimation.",
    category: { slug: "tasses", name: "Tasses" },
    basePrice: "650.00",
    minQty: 12,
    unitLabel: "pièce",
    colors: ["Blanc"],
    placements: ["FRONT", "WRAP"],
    priceTiers: [
      { minQty: 12, unitPrice: "650.00" },
      { minQty: 50, unitPrice: "575.00" },
      { minQty: 100, unitPrice: "495.00" },
    ],
  }),
  base({
    slug: "polo-brode",
    name: "Polo brodé",
    category: { slug: "t-shirts-polos", name: "T-shirts & polos" },
    basePrice: "1450.00",
    minQty: 10,
    unitLabel: "pièce",
    colors: ["Teal", "Blanc"],
    sizes: ["S", "M", "L", "XL"],
    placements: ["FRONT", "CHEST_LEFT", "BACK", "SLEEVE"],
    priceTiers: [
      { minQty: 10, unitPrice: "1450.00" },
      { minQty: 50, unitPrice: "1300.00" },
    ],
  }),
  base({
    slug: "banderole-pvc",
    name: "Banderole PVC extérieure",
    category: { slug: "banderoles", name: "Banderoles" },
    basePrice: "2800.00",
    minQty: 1,
    unitLabel: "banderole",
    sizes: ["2 × 1 m", "3 × 1,2 m", "4 × 1,5 m"],
    placements: ["FULL"],
    pricingMode: "PER_AREA",
    supportsArtwork: true,
    artworkRequired: true,
    customSize: { minWidthCm: 50, maxWidthCm: 1000, minHeightCm: 50, maxHeightCm: 500, defaultWidthCm: 300, defaultHeightCm: 120, minBillableM2: 1 },
    priceTiers: [
      { minQty: 1, unitPrice: "2800.00" },
      { minQty: 5, unitPrice: "2500.00" },
      { minQty: 10, unitPrice: "2200.00" },
    ],
  }),
  base({
    slug: "roll-up",
    name: "Roll-up 85 × 200 cm",
    category: { slug: "roll-up", name: "Roll-up" },
    basePrice: "7500.00",
    minQty: 1,
    unitLabel: "roll-up",
    sizeLabel: "Format",
    sizes: ["85 × 200 cm", "100 × 200 cm", "120 × 200 cm"],
    placements: ["FRONT"],
    supportsArtwork: true,
    artworkRequired: true,
    priceTiers: [{ minQty: 1, unitPrice: "7500.00" }],
  }),
  base({
    slug: "ballon-personnalise",
    name: "Ballons personnalisés",
    category: { slug: "ballons", name: "Ballons" },
    basePrice: "45.00",
    minQty: 100,
    unitLabel: "ballon",
    colors: ["Blanc", "Rouge", "Bleu"],
    placements: ["FRONT", "BACK"],
    priceTiers: [
      { minQty: 100, unitPrice: "45.00" },
      { minQty: 500, unitPrice: "38.00" },
    ],
  }),
];

PRODUCTS.push(
  base({
    slug: "t-shirt-personnalise",
    name: "T-shirt personnalisé",
    category: { slug: "t-shirts-polos", name: "T-shirts & polos" },
    basePrice: "750.00",
    minQty: 12,
    unitLabel: "pièce",
    colors: ["Rouge", "Bleu royal", "Noir", "Blanc"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    placements: ["FRONT", "BACK", "CHEST_LEFT", "SLEEVE"],
    priceTiers: [
      { minQty: 12, unitPrice: "750.00" },
      { minQty: 50, unitPrice: "650.00" },
    ],
  }),
  base({
    slug: "ballon-football",
    name: "Ballon de football personnalisé",
    description: "Ballon de football taille 5 (taille officielle).",
    category: { slug: "ballons", name: "Ballons" },
    basePrice: "1800.00",
    minQty: 10,
    unitLabel: "ballon",
    placements: ["FRONT", "BACK"],
    priceTiers: [
      { minQty: 10, unitPrice: "1800.00" },
      { minQty: 50, unitPrice: "1500.00" },
    ],
  }),
  base({
    slug: "coque-telephone",
    name: "Coque de téléphone personnalisée",
    category: { slug: "accessoires", name: "Accessoires" },
    basePrice: "650.00",
    minQty: 5,
    unitLabel: "coque",
    sizeLabel: "Modèle du téléphone",
    sizes: ["iPhone 11", "iPhone 12", "iPhone 13", "iPhone 14", "Samsung A14", "Samsung A54", "Tecno Spark 10"],
    placements: ["FRONT"],
    priceTiers: [{ minQty: 5, unitPrice: "650.00" }],
  }),
  base({
    slug: "tente-pliante-3x3",
    name: "Tente pliante personnalisée",
    category: { slug: "tentes", name: "Tentes" },
    basePrice: "38000.00",
    minQty: 1,
    unitLabel: "tente",
    colorLabel: "Couleur du toit",
    colors: ["Blanc", "Bleu", "Rouge"],
    sizeLabel: "Dimensions",
    sizes: ["3 × 3 m", "3 × 4,5 m", "3 × 6 m"],
    placements: ["TOP", "FRONT", "SIDE", "BACK"],
    supportsArtwork: true,
    priceTiers: [{ minQty: 1, unitPrice: "38000.00" }],
  }),
);

const uploads = new Map(); // id -> { buf, mime, name, purpose, at }
const orders = new Map(); // ref -> order
let orderSeq = 0;

const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
const tierRate = (p, qty) => Number(p.priceTiers.filter((t) => t.minQty <= qty).sort((a, b) => b.minQty - a.minQty)[0]?.unitPrice ?? p.basePrice);

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": Buffer.isBuffer(body) ? headers["Content-Type"] : "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cross-Origin-Resource-Policy": "cross-origin",
    ...headers,
  });
  res.end(buf);
}
const ok = (res, data, status = 200) => send(res, status, { data });
const fail = (res, status, code, message, details) => send(res, status, { error: { code, message, details } });

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function sniff(buf) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

/** Extracts the first file part of a multipart body (enough for tests). */
function parseMultipart(buf, contentType) {
  const m = /boundary=(.+)$/i.exec(contentType || "");
  if (!m) return null;
  const boundary = Buffer.from(`--${m[1]}`);
  const start = buf.indexOf(boundary);
  const headEnd = buf.indexOf("\r\n\r\n", start);
  if (start < 0 || headEnd < 0) return null;
  const head = buf.subarray(start, headEnd).toString();
  const bodyStart = headEnd + 4;
  const end = buf.indexOf(Buffer.concat([Buffer.from("\r\n"), boundary]), bodyStart);
  const name = /filename="([^"]*)"/.exec(head)?.[1] ?? "file";
  return { name, data: buf.subarray(bodyStart, end < 0 ? buf.length : end) };
}

function handleUpload(req, res, purpose, buf) {
  const part = parseMultipart(buf, req.headers["content-type"]);
  if (!part || !part.data.length) return fail(res, 422, "VALIDATION_ERROR", "Fichier manquant.", [{ field: "file", messages: ["file is required"] }]);
  const limit = purpose === "ARTWORK" ? 25 * 1024 * 1024 : purpose === "PREVIEW" ? 3 * 1024 * 1024 : 10 * 1024 * 1024;
  if (part.data.length > limit) return fail(res, 413, "PAYLOAD_TOO_LARGE", "Fichier trop volumineux.");
  const mime = sniff(part.data);
  if (!mime) return fail(res, 422, "UNSUPPORTED_FILE_TYPE", "Format accepté : PNG, JPG, WEBP ou PDF.");
  const id = crypto.randomUUID();
  uploads.set(id, { buf: part.data, mime, name: part.name, purpose, at: Date.now() });
  if (purpose === "PREVIEW" && !["image/png", "image/jpeg"].includes(mime)) return fail(res, 422, "UNSUPPORTED_FILE_TYPE", "Aperçu : PNG ou JPEG.");
  const kind = purpose === "ARTWORK" ? "artwork" : purpose === "PREVIEW" ? "previews" : "logos";
  return ok(res, { id, url: `/api/v1/uploads/${kind}/${id}`, mimeType: mime, size: part.data.length, originalName: part.name }, 201);
}

const num = (v) => typeof v === "number" && Number.isFinite(v);

const publicOrder = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));

function validateOrder(body) {
  const errors = [];
  const add = (field, msg) => errors.push({ field, messages: [msg] });
  const c = body?.customer;
  if (!c?.fullName || c.fullName.length < 2) add("customer.fullName", "fullName must be longer than 2 characters");
  if (!c?.email || !/^\S+@\S+\.\S+$/.test(c.email)) add("customer.email", "email must be an email");
  if (!c?.phone || !/^\+?[0-9][0-9 -]{6,18}[0-9]$/.test(c.phone)) add("customer.phone", "phone is invalid");
  if (!["PICKUP", "DELIVERY"].includes(body?.deliveryMethod)) add("deliveryMethod", "deliveryMethod is invalid");
  if (!Array.isArray(body?.items) || body.items.length < 1) add("items", "items must contain at least 1 element");
  return errors;
}

function buildItem(raw, i, res) {
  const p = PRODUCTS.find((x) => x.slug === raw.productSlug);
  if (!p) return { error: () => fail(res, 404, "PRODUCT_NOT_FOUND", `Produit introuvable : ${raw.productSlug}`) };
  if (!Number.isInteger(raw.quantity) || raw.quantity < p.minQty) return { error: () => fail(res, 422, "QUANTITY_BELOW_MINIMUM", "Quantité sous le minimum.") };
  // product parameters (contract §7.1)
  if (p.colors.length) {
    if (raw.color && !p.colors.includes(raw.color)) return { error: () => fail(res, 422, "INVALID_OPTION", "Option invalide.") };
    if (p.colorsRequired && !raw.color) return { error: () => fail(res, 422, "COLOR_REQUIRED", "Couleur requise.") };
  } else if (raw.color) return { error: () => fail(res, 422, "INVALID_OPTION", "Ce produit n'a pas de couleur.") };
  if (p.sizes.length && !p.customSize) {
    if (raw.size && !p.sizes.includes(raw.size)) return { error: () => fail(res, 422, "INVALID_OPTION", "Option invalide.") };
    if (p.sizesRequired && !raw.size) return { error: () => fail(res, 422, "SIZE_REQUIRED", "Taille requise.") };
  } else if (raw.size && !p.customSize) return { error: () => fail(res, 422, "INVALID_OPTION", "Ce produit n'a pas de taille.") };
  const prevs = Array.isArray(raw.previews) ? raw.previews : [];
  if (prevs.length > 12 || prevs.some((x) => uploads.get(x?.uploadId)?.purpose !== "PREVIEW")) {
    return { error: () => fail(res, 422, "UPLOAD_NOT_FOUND", "Aperçu introuvable.") };
  }
  const els = raw.elements;
  if (!Array.isArray(els) || els.length < 1 || els.length > 30) {
    return { error: () => fail(res, 422, "VALIDATION_ERROR", "Validation failed", [{ field: `items.${i}.elements`, messages: ["elements must contain 1..30 elements"] }]) };
  }
  for (let j = 0; j < els.length; j++) {
    const e = els[j];
    const f = (k) => `items.${i}.elements.${j}.${k}`;
    const bad = (k, m) => ({ error: () => fail(res, 422, "VALIDATION_ERROR", "Validation failed", [{ field: f(k), messages: [m] }]) });
    if (!p.placements.includes(e.placement)) return bad("placement", "placement is not available for this product");
    if (!["LOGO", "TEXT", "ARTWORK"].includes(e.kind)) return bad("kind", "kind is invalid");
    if ((e.kind === "LOGO" && !p.supportsLogo) || (e.kind === "TEXT" && !p.supportsText) || (e.kind === "ARTWORK" && !p.supportsArtwork)) {
      return { error: () => fail(res, 422, "ELEMENT_NOT_SUPPORTED", "Élément non supporté.") };
    }
    if (!num(e.x) || e.x < -0.5 || e.x > 0.5) return bad("x", "x must be between -0.5 and 0.5");
    if (!num(e.y) || e.y < -0.5 || e.y > 0.5) return bad("y", "y must be between -0.5 and 0.5");
    if (!num(e.scale) || e.scale < 0.05 || e.scale > 4) return bad("scale", "scale must be between 0.05 and 4");
    if (!num(e.rotation) || e.rotation < -180 || e.rotation > 180) return bad("rotation", "rotation must be between -180 and 180");
    if (e.kind === "TEXT") {
      if (typeof e.text !== "string" || !e.text.trim() || e.text.length > 200 || e.text.split("\n").length > 6) return bad("text", "text must be 1..200 characters, 6 lines max");
      if (e.font && !FONTS.includes(e.font)) return bad("font", "font is not allowed");
      if (e.color && !/^#[0-9a-fA-F]{6}$/.test(e.color)) return bad("color", "color must be #RRGGBB");
    } else {
      const up = uploads.get(e.uploadId);
      if (!up) return { error: () => fail(res, 422, "UPLOAD_NOT_FOUND", "Fichier introuvable.") };
    }
  }
  if (p.artworkRequired && !els.some((e) => e.kind === "ARTWORK")) return { error: () => fail(res, 422, "ARTWORK_REQUIRED", "Fichier prêt à imprimer requis.") };
  let areaM2;
  if (p.customSize) {
    const cs = p.customSize;
    const { widthCm: w, heightCm: h } = raw;
    if (!num(w) || !num(h) || w < cs.minWidthCm || w > cs.maxWidthCm || h < cs.minHeightCm || h > cs.maxHeightCm) {
      return { error: () => fail(res, 422, "SIZE_OUT_OF_RANGE", "Dimensions hors limites.") };
    }
    areaM2 = Math.max((w * h) / 10000, cs.minBillableM2);
  }
  const rate = tierRate(p, raw.quantity);
  const unit = p.pricingMode === "PER_AREA" ? Math.round(areaM2 * rate * 100) / 100 : rate; // client prices are ignored
  const sorted = els.map((e, idx) => ({ ...e, sort: e.sort ?? idx }));
  return {
    item: {
      productSlug: p.slug,
      productName: p.name,
      quantity: raw.quantity,
      color: raw.color ?? null,
      size: raw.size ?? null,
      widthCm: raw.widthCm ?? null,
      heightCm: raw.heightCm ?? null,
      areaM2: areaM2 === undefined ? null : money(areaM2),
      placement: els[0].placement,
      previews: prevs.map((x) => ({ placement: x.placement, url: `/api/v1/uploads/previews/${x.uploadId}` })),
      logoUrl: (() => {
        const e = els.find((x) => x.uploadId);
        return e ? `/api/v1/uploads/${uploads.get(e.uploadId).purpose === "ARTWORK" ? "artwork" : "logos"}/${e.uploadId}` : null;
      })(),
      elements: sorted.map((e) => ({
        placement: e.placement,
        kind: e.kind,
        text: e.text ?? null,
        font: e.kind === "TEXT" ? (e.font ?? "inter") : null,
        fontWeight: e.kind === "TEXT" ? (e.fontWeight ?? "regular") : null,
        color: e.kind === "TEXT" ? (e.color ?? "#000000") : null,
        align: e.kind === "TEXT" ? (e.align ?? "center") : null,
        x: e.x,
        y: e.y,
        scale: e.scale,
        rotation: e.rotation,
        sort: e.sort,
        logoUrl: e.uploadId ? `/api/v1/uploads/${uploads.get(e.uploadId).purpose === "ARTWORK" ? "artwork" : "logos"}/${e.uploadId}` : null,
        originalName: e.uploadId ? uploads.get(e.uploadId).name : null,
      })),
      unitPrice: money(unit),
      lineTotal: money(unit * raw.quantity),
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/^\/api\/v1/, "");
  if (req.method === "OPTIONS") return send(res, 204, Buffer.alloc(0), { "Content-Type": "text/plain" });
  try {
    if (path === "/health") return ok(res, { status: "ok", mock: true });
    if (req.method === "GET" && path === "/catalog/products") return ok(res, PRODUCTS);
    let m = /^\/catalog\/products\/([^/]+)$/.exec(path);
    if (req.method === "GET" && m) {
      const p = PRODUCTS.find((x) => x.slug === decodeURIComponent(m[1]));
      return p ? ok(res, p) : fail(res, 404, "NOT_FOUND", "Produit introuvable.");
    }
    if (req.method === "POST" && (path === "/uploads/logos" || path === "/uploads/artwork" || path === "/uploads/previews")) {
      return handleUpload(req, res, path.endsWith("artwork") ? "ARTWORK" : path.endsWith("previews") ? "PREVIEW" : "LOGO", await readBody(req));
    }
    m = /^\/uploads\/(logos|artwork|previews)\/([^/]+)$/.exec(path);
    if (req.method === "GET" && m) {
      const u = uploads.get(m[2]);
      if (!u) return fail(res, 404, "NOT_FOUND", "Fichier introuvable.");
      return send(res, 200, u.buf, { "Content-Type": u.mime, "X-Content-Type-Options": "nosniff" });
    }
    if (req.method === "POST" && path === "/custom-orders") {
      let body;
      try {
        body = JSON.parse((await readBody(req)).toString() || "{}");
      } catch {
        return fail(res, 422, "VALIDATION_ERROR", "JSON invalide.");
      }
      const errs = validateOrder(body);
      if (errs.length) return fail(res, 422, "VALIDATION_ERROR", "Validation failed", errs);
      const items = [];
      for (let i = 0; i < body.items.length; i++) {
        const r = buildItem(body.items[i], i, res);
        if (r.error) return r.error();
        items.push(r.item);
      }
      const reference = `IP-2026-${String(++orderSeq).padStart(6, "0")}`;
      const order = { reference, status: "RECEIVED", createdAt: new Date().toISOString(), currency: "HTG", subtotal: money(items.reduce((n, it) => n + Number(it.lineTotal), 0)), items, _email: body.customer.email.toLowerCase(), _raw: body };
      orders.set(reference, order);
      return ok(res, publicOrder(order), 201);
    }
    m = /^\/custom-orders\/([^/]+)$/.exec(path);
    if (req.method === "GET" && m) {
      const o = orders.get(decodeURIComponent(m[1]));
      if (!o || o._email !== (url.searchParams.get("email") || "").toLowerCase()) return fail(res, 404, "ORDER_NOT_FOUND", "Commande introuvable.");
      return ok(res, publicOrder(o));
    }
    // test helper: last raw order payload received (to assert the exact contract payload)
    if (req.method === "GET" && path === "/__test/last-order") {
      const last = [...orders.values()].pop();
      return last ? ok(res, last._raw) : fail(res, 404, "NOT_FOUND", "no order");
    }
    return fail(res, 404, "NOT_FOUND", "Route inconnue.");
  } catch (e) {
    return fail(res, 500, "INTERNAL", String(e));
  }
});

server.listen(PORT, () => console.log(`mock API listening on :${PORT}`));
