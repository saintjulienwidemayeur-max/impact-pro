/**
 * Customer-account client. Every call is SAME-ORIGIN (`/api/v1/...`, proxied to the API by `rewrites()` in
 * next.config.ts) so the HTTP-only session cookie is first-party and works in Safari/iPhone. State-changing calls echo
 * the readable `ip_csrf` cookie in the `x-csrf-token` header. No token is ever kept in localStorage.
 */
import { ApiError, parseError, type CustomOrder, type CustomOrderStatus } from "./api";

export interface AccountUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: "CUSTOMER" | "STAFF";
  emailVerified: boolean;
  createdAt: string;
}

export interface OrderSummary {
  reference: string;
  status: CustomOrderStatus;
  currency: string;
  subtotal: string;
  createdAt: string;
  itemCount: number;
  firstProductName: string | null;
  previewUrl: string | null;
}

export interface Page<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number };
}

const CSRF_COOKIE = "ip_csrf";

/** The readable CSRF cookie set by the API (null on the server, or when nobody is signed in). */
export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(`${CSRF_COOKIE}=`)) return decodeURIComponent(part.slice(CSRF_COOKIE.length + 1));
  }
  return null;
}

/** True when a session looks open in this browser (the CSRF cookie only exists for signed-in users). */
export const hasSessionHint = (): boolean => readCsrfCookie() !== null;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  /** Extra headers merged last. */
  headers?: Record<string, string>;
}

async function call<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: Page<unknown>["meta"] }> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = readCsrfCookie();
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(method === "GET" ? 15_000 : 30_000),
    });
  } catch {
    throw new ApiError("Le service est momentanément indisponible.", 0, "NETWORK_ERROR");
  }
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { data: T; meta?: Page<unknown>["meta"] };
  return body;
}

/** Current user, or null for guests (the API answers 200 in both cases). */
export async function fetchMe(): Promise<AccountUser | null> {
  const { data } = await call<{ user: AccountUser | null }>("/auth/me");
  return data.user;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  acceptTerms: boolean;
}

export async function registerAccount(input: RegisterInput): Promise<AccountUser> {
  const { data } = await call<{ user: AccountUser }>("/auth/register", { method: "POST", body: input });
  return data.user;
}

export async function loginAccount(email: string, password: string): Promise<AccountUser> {
  const { data } = await call<{ user: AccountUser }>("/auth/login", { method: "POST", body: { email, password } });
  return data.user;
}

export async function logoutAccount(): Promise<void> {
  await call<{ ok: true }>("/auth/logout", { method: "POST" });
}

export async function updateProfile(input: { fullName?: string; phone?: string | null }): Promise<AccountUser> {
  const { data } = await call<{ user: AccountUser }>("/auth/me", { method: "PATCH", body: input });
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ revokedSessions: number }> {
  const { data } = await call<{ revokedSessions: number }>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
  return data;
}

export async function listMyOrders(page = 1, pageSize = 10): Promise<Page<OrderSummary>> {
  const { data, meta } = await call<OrderSummary[]>(`/me/orders?page=${page}&pageSize=${pageSize}`);
  return { items: data, meta: meta ?? { page, pageSize, total: data.length } };
}

/** Returns null when the order does not exist or is not mine (404). */
export async function getMyOrder(reference: string): Promise<CustomOrder | null> {
  try {
    const { data } = await call<CustomOrder>(`/me/orders/${encodeURIComponent(reference)}`);
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Attaches a guest order to the account; false when the reference / e-mail do not match. */
export async function claimOrder(reference: string, email: string): Promise<boolean> {
  try {
    await call<CustomOrder>("/me/orders/claim", { method: "POST", body: { reference, email } });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return false;
    throw e;
  }
}

/** Places an order as the signed-in customer (cookie + CSRF header) through the same-origin proxy. */
export async function createOrderAsMember(input: unknown): Promise<CustomOrder> {
  const { data } = await call<CustomOrder>("/custom-orders", { method: "POST", body: input });
  return data;
}

/* ---------- French messages ---------- */

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mail ou mot de passe incorrect.",
  EMAIL_TAKEN: "Un compte existe déjà avec cet e-mail. Connectez-vous plutôt.",
  INVALID_CURRENT_PASSWORD: "Le mot de passe actuel est incorrect.",
  PASSWORD_UNCHANGED: "Le nouveau mot de passe doit être différent de l'ancien.",
  UNAUTHENTICATED: "Votre session a expiré. Veuillez vous reconnecter.",
  CSRF_INVALID: "Votre session a changé. Rechargez la page et réessayez.",
  ORIGIN_NOT_ALLOWED: "Cette requête n'est pas autorisée depuis ce site.",
};

export function accountErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "TOO_MANY_ATTEMPTS") {
      const secs = (e.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      if (secs) return `Trop de tentatives. Réessayez dans ${secs >= 90 ? `${Math.ceil(secs / 60)} minutes` : `${secs} secondes`}.`;
      return "Trop de tentatives. Réessayez plus tard.";
    }
    if (messages[e.code]) return messages[e.code];
    if (e.status === 429) return "Trop de demandes. Patientez un instant puis réessayez.";
    if (e.status === 0 || e.status >= 500) return "Le service est momentanément indisponible. Réessayez dans un instant.";
    return e.message;
  }
  return "Une erreur inattendue est survenue.";
}

/** `{ field: message }` from a 422 (password policy messages arrive in French from the API). */
export function accountFieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || e.code !== "VALIDATION_ERROR" || !Array.isArray(e.details)) return {};
  const out: Record<string, string> = {};
  for (const d of e.details as { field?: string; messages?: string[] }[]) {
    if (d.field && d.messages?.length && !out[d.field]) out[d.field] = d.messages.join(" ");
  }
  return out;
}

/** Password strength hint shown while typing (mirrors the API policy; the API stays the authority). */
export function passwordHints(password: string, email = ""): { ok: boolean; items: { label: string; ok: boolean }[]; score: 0 | 1 | 2 | 3 } {
  const long = [...password].length >= 10;
  const notDigits = !/^[0-9]*$/.test(password) || password.length === 0;
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const noEmail = !(local.length >= 4 && password.toLowerCase().includes(local));
  const varied = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length >= 2;
  const items = [
    { label: "10 caractères minimum", ok: long },
    { label: "Pas uniquement des chiffres", ok: notDigits && password.length > 0 },
    { label: "Ne contient pas votre e-mail", ok: noEmail },
  ];
  const score = (!long ? 0 : [varied, [...password].length >= 14, notDigits && noEmail].filter(Boolean).length) as 0 | 1 | 2 | 3;
  return { ok: items.every((i) => i.ok), items, score };
}
