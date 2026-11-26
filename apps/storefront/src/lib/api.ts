/**
 * Typed client for the Impact Pro API (`/api/v1`, envelope `{ data, meta? }` / `{ error }` — CLAUDE.md §12).
 * Server components use `API_URL` (internal), browsers use `NEXT_PUBLIC_API_URL`.
 */

export const PLACEMENTS = ["FRONT", "BACK", "CHEST_LEFT", "SLEEVE", "WRAP", "FULL"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const placementLabels: Record<Placement, string> = {
  FRONT: "Devant",
  BACK: "Dos",
  CHEST_LEFT: "Cœur (poitrine gauche)",
  SLEEVE: "Manche",
  WRAP: "Tour complet",
  FULL: "Pleine surface",
};

export interface PriceTier {
  minQty: number;
  unitPrice: string;
}

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface Product {
  slug: string;
  name: string;
  description: string | null;
  category: { slug: string; name: string };
  basePrice: string;
  compareAtPrice?: string | null;
  currency?: string;
  minQty: number;
  unitLabel: string;
  colors: string[];
  sizes: string[];
  placements: Placement[];
  priceTiers: PriceTier[];
  /** Image URLs (strings) — objects tolerated for forward compatibility. */
  images: (string | ProductImage)[];
}

export interface UploadedLogo {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export type DeliveryMethod = "PICKUP" | "DELIVERY";

export interface CustomOrderInput {
  customer: { fullName: string; company?: string; phone: string; email: string; city?: string; address?: string };
  items: {
    productSlug: string;
    quantity: number;
    color?: string;
    size?: string;
    placement: Placement;
    logoUploadId: string;
    notes?: string;
  }[];
  deliveryMethod: DeliveryMethod;
  notes?: string;
}

export interface CustomOrderItem {
  productSlug: string;
  productName: string;
  quantity: number;
  color: string | null;
  size: string | null;
  placement: Placement;
  unitPrice: string;
  lineTotal: string;
  logoUrl: string;
}

export type CustomOrderStatus = "RECEIVED" | "MOCKUP_SENT" | "APPROVED" | "IN_PRODUCTION" | "READY" | "DELIVERED" | "CANCELLED";

export const orderStatusLabels: Record<CustomOrderStatus, string> = {
  RECEIVED: "Commande reçue",
  MOCKUP_SENT: "Maquette envoyée",
  APPROVED: "Maquette validée",
  IN_PRODUCTION: "En production",
  READY: "Prête",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export interface CustomOrder {
  reference: string;
  status: CustomOrderStatus;
  createdAt: string;
  currency: string;
  subtotal: string;
  items: CustomOrderItem[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const DEFAULT_API = "http://localhost:4000";

export function apiBaseUrl(): string {
  const isServer = typeof window === "undefined";
  const url = (isServer ? process.env.API_URL || process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL) || DEFAULT_API;
  return url.replace(/\/$/, "");
}

/** Resolves a URL returned by the API (absolute, or relative to the API origin). */
export function resolveApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  const base = typeof window === "undefined" ? apiBaseUrl() : (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API).replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

type Envelope<T> = { data: T; meta?: unknown };
type ErrorBody = { error?: { code?: string; message?: string; details?: unknown } };

export async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ErrorBody | null;
  return new ApiError(
    body?.error?.message ?? `Erreur ${res.status}`,
    res.status,
    body?.error?.code ?? (res.status === 404 ? "NOT_FOUND" : "HTTP_ERROR"),
    body?.error?.details,
  );
}

async function request<T>(path: string, init: RequestInit & { next?: { revalidate?: number | false } } = {}): Promise<T> {
  let res: Response;
  try {
    // Never hang: a sleeping/unreachable API must not block page rendering or `next build` (60 s/page limit).
    const timeoutMs = !init.method || init.method === "GET" ? 15_000 : 30_000;
    res = await fetch(`${apiBaseUrl()}/api/v1${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch (cause) {
    throw new ApiError("Le service est momentanément indisponible.", 0, "NETWORK_ERROR", cause instanceof Error ? cause.message : undefined);
  }
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as Envelope<T>;
  return body.data;
}

/* ---------- Catalog (server components) ---------- */

export async function listProducts(): Promise<Product[]> {
  const data = await request<Product[]>("/catalog/products?pageSize=100", { next: { revalidate: 60 } });
  return Array.isArray(data) ? data : [];
}

/** Returns null when the product does not exist (404); throws on other failures. */
export async function getProduct(slug: string): Promise<Product | null> {
  try {
    return await request<Product>(`/catalog/products/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/* ---------- Orders ---------- */

export async function createCustomOrder(input: CustomOrderInput): Promise<CustomOrder> {
  return request<CustomOrder>("/custom-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Returns null when no order matches (404); throws on other failures. */
export async function getCustomOrder(reference: string, email: string): Promise<CustomOrder | null> {
  try {
    return await request<CustomOrder>(
      `/custom-orders/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`,
      { cache: "no-store" },
    );
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

/* ---------- Uploads (browser) ---------- */

/** Uploads a logo with progress reporting (XHR, since fetch has no upload progress). */
export function uploadLogo(file: File, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<UploadedLogo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl()}/api/v1/uploads/logos`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response as (Envelope<UploadedLogo> & ErrorBody) | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) {
        resolve(body.data);
      } else {
        reject(new ApiError(body?.error?.message ?? "Téléversement impossible.", xhr.status, body?.error?.code ?? "UPLOAD_FAILED", body?.error?.details));
      }
    };
    xhr.onerror = () => reject(new ApiError("Le service est momentanément indisponible.", 0, "NETWORK_ERROR"));
    xhr.onabort = () => reject(new ApiError("Téléversement annulé.", 0, "ABORTED"));
    signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/* ---------- Error messages ---------- */

const codeMessages: Record<string, string> = {
  NETWORK_ERROR: "Le service est momentanément indisponible. Vérifiez votre connexion et réessayez.",
  VALIDATION_ERROR: "Certains champs sont invalides. Vérifiez le formulaire.",
  ORDER_NOT_FOUND: "Aucune commande ne correspond à cette référence et cette adresse courriel.",
  QUANTITY_BELOW_MINIMUM: "La quantité est inférieure au minimum de commande pour un article.",
  UPLOAD_NOT_FOUND: "Un logo n'a pas été retrouvé sur nos serveurs. Merci de le téléverser à nouveau.",
  PRODUCT_NOT_FOUND: "Un produit de votre panier n'est plus disponible.",
  INVALID_PLACEMENT: "L'emplacement choisi n'est pas disponible pour ce produit.",
  INVALID_OPTION: "Une option (couleur ou taille) n'est pas disponible.",
  TOO_MANY_REQUESTS: "Trop de tentatives. Patientez une minute avant de réessayer.",
  FILE_TOO_LARGE: "Le fichier dépasse 10 Mo.",
  PAYLOAD_TOO_LARGE: "Le fichier dépasse 10 Mo.",
  UNSUPPORTED_FILE_TYPE: "Format accepté : PNG, JPG, WEBP ou PDF.",
};

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (codeMessages[e.code]) return codeMessages[e.code];
    if (e.status === 413) return codeMessages.FILE_TOO_LARGE;
    if (e.status === 415) return codeMessages.UNSUPPORTED_FILE_TYPE;
    if (e.status === 429) return codeMessages.TOO_MANY_REQUESTS;
    if (e.status >= 500 || e.status === 0) return codeMessages.NETWORK_ERROR;
    return e.message;
  }
  return "Une erreur inattendue est survenue.";
}

/**
 * Normalizes validation details into `{ "path.to.field": message }`.
 * Accepts `[{ field|path, message }]` or `{ field: message | message[] }`.
 */
export function detailsToFields(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(details)) {
    for (const d of details) {
      // class-validator style: "customer.email must be an email"
      if (typeof d === "string") {
        const key = d.split(" ")[0];
        if (key && !out[key]) out[key] = d;
        continue;
      }
      if (d && typeof d === "object") {
        const rec = d as Record<string, unknown>;
        const raw = rec.field ?? rec.path ?? rec.property;
        const key = Array.isArray(raw) ? raw.join(".") : typeof raw === "string" ? raw : "";
        const msg = rec.message ?? (Array.isArray(rec.messages) ? rec.messages[0] : undefined) ?? rec.constraints;
        if (key && !out[key]) out[key] = typeof msg === "string" ? msg : "Valeur invalide.";
      }
    }
  } else if (details && typeof details === "object") {
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
      out[k] = Array.isArray(v) ? String(v[0]) : typeof v === "string" ? v : "Valeur invalide.";
    }
  }
  return out;
}
