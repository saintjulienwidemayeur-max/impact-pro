/**
 * Admin API client. Every call is SAME-ORIGIN (`/api/v1/...`, proxied to the API by `rewrites()` in next.config.ts) so
 * the HTTP-only session cookie is first-party. State-changing calls echo the readable `ip_csrf` cookie in the
 * `x-csrf-token` header. Nothing is kept in localStorage.
 */
import type { Meta } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: { field: string; messages: string[] }[],
  ) {
    super(message);
  }
  /** Field → first message, for form validation errors (422). */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) out[d.field] = d.messages[0] ?? "Valeur invalide";
    return out;
  }
}

const CSRF_COOKIE = "ip_csrf";
export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(`${CSRF_COOKIE}=`)) return decodeURIComponent(part.slice(CSRF_COOKIE.length + 1));
  }
  return null;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
interface Opts {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

/** Fired when the server says the session is gone (401) so the shell can send the user to /login. */
export const SESSION_EXPIRED_EVENT = "ip-admin-session-expired";

export function qs(query?: Opts["query"]): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function friendly(code: string | undefined, fallback: string): string {
  switch (code) {
    case "MAIL_NOT_CONFIGURED":
      return "La messagerie n'est pas encore configurée : le document n'a pas été envoyé. Utilisez « Marquer comme envoyé » si vous l'avez transmis autrement.";
    case "FORBIDDEN":
      return "Vous n'avez pas la permission d'effectuer cette action.";
    case "INVALID_TRANSITION":
      return "Ce changement de statut n'est pas autorisé.";
    case "CONFLICT":
      return fallback || "Conflit : l'élément a été modifié entre-temps.";
    default:
      return fallback;
  }
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<{ data: T; meta?: Meta }> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = readCsrfCookie();
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}${qs(opts.query)}`, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal ?? AbortSignal.timeout(method === "GET" ? 20_000 : 40_000),
    });
  } catch {
    throw new ApiError("Le serveur est momentanément injoignable. Réessayez dans un instant.", 0, "NETWORK_ERROR");
  }
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: { field: string; messages: string[] }[] } } = {};
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    const code = body.error?.code;
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(friendly(code, body.error?.message ?? `Erreur ${res.status}`), res.status, code, body.error?.details);
  }
  if (res.status === 204) return { data: undefined as T };
  const json = (await res.json()) as { data: T; meta?: Meta };
  return json;
}

export const get = <T>(path: string, query?: Opts["query"]) => api<T>(path, { query }).then((r) => r.data);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} }).then((r) => r.data);
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body }).then((r) => r.data);
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body }).then((r) => r.data);
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" }).then((r) => r.data);
