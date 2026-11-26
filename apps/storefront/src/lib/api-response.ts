import { NextResponse } from "next/server";

/** Response envelope aligned with the API convention `{ data, meta?, error? }` (CLAUDE.md §12). */
export function accepted<T>(data: T) {
  return NextResponse.json({ data }, { status: 202 });
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: { code: "VALIDATION_ERROR", message, fields } }, { status: 400 });
}

export function serverError(message = "Erreur interne. Réessayez plus tard.") {
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
}

/** Rejects cross-site form posts (basic CSRF guard for route handlers). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers / server-side calls
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
