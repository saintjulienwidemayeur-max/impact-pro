import { NextResponse } from "next/server";
import { badRequest, isSameOrigin, serverError } from "@/lib/api-response";
import { apiBaseUrl, detailsToFields } from "@/lib/api";
import { fieldErrors, quoteSchema } from "@/lib/schemas";

/**
 * Proforma request (JSON). Validated here (French messages), then stored by the API
 * (`POST /api/v1/quote-requests`) where the team follows it up in the back-office.
 * The optional logo is already stored by the API (`logoUploadId` from `POST /api/v1/uploads/logos`).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return badRequest("Origine non autorisée.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Formulaire invalide.");
  }

  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Certains champs sont invalides.", fieldErrors(parsed.error));

  const v = parsed.data;
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/quote-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Keeps the customer's account link (the API attaches the request when the session + CSRF are valid).
        ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie")! } : {}),
        ...(req.headers.get("x-csrf-token") ? { "x-csrf-token": req.headers.get("x-csrf-token")! } : {}),
        ...(req.headers.get("x-forwarded-for") ? { "x-forwarded-for": req.headers.get("x-forwarded-for")! } : {}),
      },
      body: JSON.stringify({
        service: v.service,
        size: v.size || undefined,
        name: v.name,
        company: v.company || undefined,
        phone: v.phone,
        email: v.email,
        products: v.products,
        quantity: v.quantity === "" || v.quantity === undefined ? undefined : v.quantity,
        message: v.message || undefined,
        logoUploadId: v.logoUploadId || undefined,
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    return serverError("Envoi impossible pour le moment. Réessayez dans quelques minutes ou écrivez-nous.");
  }

  const payload = (await res.json().catch(() => null)) as { data?: { reference: string }; error?: { code?: string; message?: string; details?: unknown } } | null;
  if (res.ok && payload?.data?.reference) {
    return NextResponse.json({ data: { reference: payload.data.reference, status: "received" } }, { status: 201 });
  }
  if (res.status === 422) {
    const fields = detailsToFields(payload?.error?.details);
    if (payload?.error?.code === "UPLOAD_NOT_FOUND") fields.logoUploadId = "Logo introuvable, téléversez-le à nouveau.";
    return badRequest("Certains champs sont invalides.", fields);
  }
  if (res.status === 429) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Trop de demandes. Patientez quelques minutes." } }, { status: 429 });
  }
  return serverError("Envoi impossible pour le moment. Réessayez dans quelques minutes ou écrivez-nous.");
}
