import { accepted, badRequest, isSameOrigin } from "@/lib/api-response";
import { contactSchema, fieldErrors } from "@/lib/schemas";

/**
 * Contact message.
 * TODO(Phase 3): forward to `POST /api/v1/crm/contact-messages` on the NestJS API.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return badRequest("Origine non autorisée.");
  const body: unknown = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return badRequest("Certains champs sont invalides.", fieldErrors(parsed.error));
  return accepted({ status: "received" });
}
