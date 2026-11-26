import { accepted, badRequest, isSameOrigin } from "@/lib/api-response";
import { fieldErrors, newsletterSchema } from "@/lib/schemas";

/**
 * Newsletter sign-up.
 * TODO(Phase 3): forward to `POST /api/v1/crm/newsletter-subscriptions` on the NestJS API
 * to persist the subscription. Until then the request is validated and acknowledged only.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return badRequest("Origine non autorisée.");
  const body: unknown = await req.json().catch(() => null);
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) return badRequest("Adresse courriel invalide.", fieldErrors(parsed.error));
  return accepted({ email: parsed.data.email, status: "pending" });
}
