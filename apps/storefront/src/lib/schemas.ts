import { z } from "zod";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Logo formats accepted by the API (`POST /api/v1/uploads/logos`; SVG is rejected server-side). */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf";

/** Client-side logo check (the API re-verifies type from file contents). Returns an error message or null. */
export function validateLogoFile(file: { size: number; type: string; name?: string } | null | undefined): string | null {
  if (!file || file.size === 0) return "Le fichier est vide.";
  const byExt = /\.(png|jpe?g|webp|pdf)$/i.test(file.name ?? "");
  if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type) && !(file.type === "" && byExt)) {
    return "Format accepté : PNG, JPG, WEBP ou PDF.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Le fichier dépasse 10 Mo.";
  return null;
}

export const newsletterSchema = z.object({
  email: z.string().trim().email("Adresse courriel invalide."),
});

/** Mirrors the API rule: digits, spaces, dashes and an optional leading +, 8–20 characters. */
const phoneRegex = /^\+?[0-9][0-9 -]*[0-9]$/;
const phone = z
  .string()
  .trim()
  .min(8, "Numéro de téléphone invalide.")
  .max(20, "Numéro de téléphone invalide.")
  .regex(phoneRegex, "Numéro de téléphone invalide (ex. +509 3712-3456).");

export const quoteSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone,
  email: z.string().trim().email("Adresse courriel invalide."),
  products: z.string().trim().min(2, "Indiquez les produits souhaités.").max(2000),
  quantity: z.coerce
    .number({ invalid_type_error: "Indiquez une quantité." })
    .int("Quantité entière uniquement.")
    .min(1, "La quantité minimale est 1.")
    .max(1_000_000),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  logoUploadId: z.string().uuid("Logo invalide, téléversez-le à nouveau.").optional().or(z.literal("")),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.string().trim().email("Adresse courriel invalide."),
  subject: z.string().trim().min(2, "Indiquez un sujet.").max(200),
  message: z.string().trim().min(10, "Votre message doit contenir au moins 10 caractères.").max(4000),
});

export const checkoutSchema = z
  .object({
    fullName: z.string().trim().min(2, "Indiquez votre nom complet.").max(120),
    company: z.string().trim().max(160).optional().or(z.literal("")),
    phone,
    email: z.string().trim().email("Adresse courriel invalide.").max(254),
    city: z.string().trim().max(120).optional().or(z.literal("")),
    address: z.string().trim().max(300).optional().or(z.literal("")),
    deliveryMethod: z.enum(["PICKUP", "DELIVERY"], { errorMap: () => ({ message: "Choisissez un mode de réception." }) }),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.deliveryMethod === "DELIVERY") {
      if (!v.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Indiquez la ville de livraison." });
      if (!v.address || v.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: "Indiquez l'adresse de livraison." });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackingSchema = z.object({
  ref: z.string().trim().regex(/^IP-\d{4}-\d{6}$/i, "Référence au format IP-2026-000123."),
  email: z.string().trim().email("Adresse courriel invalide."),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
