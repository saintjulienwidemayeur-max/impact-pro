import { accepted, badRequest, isSameOrigin } from "@/lib/api-response";
import { fieldErrors, quoteSchema } from "@/lib/schemas";

/**
 * Quote request (JSON). The optional logo is already stored by the API (`logoUploadId` from
 * `POST /api/v1/uploads/logos`).
 * TODO(Phase 3): forward to `POST /api/v1/crm/quote-requests`. Until then the request is validated and acknowledged only.
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

  const reference = `DV-${Date.now().toString(36).toUpperCase()}`;
  return accepted({ reference, status: "received", hasLogo: Boolean(parsed.data.logoUploadId) });
}
