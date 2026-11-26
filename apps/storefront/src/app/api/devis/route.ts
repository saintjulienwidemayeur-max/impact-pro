import { accepted, badRequest, isSameOrigin } from "@/lib/api-response";
import { fieldErrors, quoteSchema, validateUpload } from "@/lib/schemas";

/**
 * Quote request (multipart/form-data, optional `logo` file).
 * TODO(Phase 3): forward to `POST /api/v1/crm/quote-requests` and upload the logo to S3-compatible
 * storage via the API. Until then the request is validated and acknowledged only.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return badRequest("Origine non autorisée.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Formulaire invalide.");
  }

  const raw = Object.fromEntries(
    ["name", "company", "phone", "email", "products", "quantity", "message"].map((k) => [k, form.get(k)?.toString() ?? ""]),
  );
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) return badRequest("Certains champs sont invalides.", fieldErrors(parsed.error));

  const logo = form.get("logo");
  const file = logo instanceof File ? logo : null;
  const uploadError = validateUpload(file);
  if (uploadError) return badRequest(uploadError, { logo: uploadError });

  const reference = `DV-${Date.now().toString(36).toUpperCase()}`;
  return accepted({ reference, status: "received", hasLogo: Boolean(file && file.size > 0) });
}
