import { z } from "zod";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ARTWORK_BYTES = 25 * 1024 * 1024;
/** Logo formats accepted by the API (`POST /api/v1/uploads/logos`; SVG is rejected server-side). */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf";

/** Client-side logo check (the API re-verifies type from file contents). Returns an error message or null. */
export function validateLogoFile(file: { size: number; type: string; name?: string } | null | undefined, maxBytes = MAX_UPLOAD_BYTES): string | null {
  if (!file || file.size === 0) return "Le fichier est vide.";
  const byExt = /\.(png|jpe?g|webp|pdf)$/i.test(file.name ?? "");
  if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type) && !(file.type === "" && byExt)) {
    return "Format accepté : PNG, JPG, WEBP ou PDF.";
  }
  if (file.size > maxBytes) return `Le fichier dépasse ${Math.round(maxBytes / 1024 / 1024)} Mo.`;
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
  service: z.enum(["articles", "sourcing", "evenement", "conseil"], { errorMap: () => ({ message: "Choisissez un service." }) }),
  size: z.enum(["petit", "moyen", "grand"]).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone,
  email: z.string().trim().email("Adresse courriel invalide."),
  products: z.string().trim().min(2, "Décrivez votre projet.").max(2000),
  quantity: z
    .union([
      z.literal(""),
      z.coerce.number({ invalid_type_error: "Quantité invalide." }).int("Quantité entière uniquement.").min(1, "La quantité minimale est 1.").max(1_000_000),
    ])
    .optional(),
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

/* ---------- Customer accounts ---------- */

const optionalPhone = z
  .string()
  .trim()
  .max(20, "Numéro de téléphone invalide.")
  .refine((v) => v === "" || (v.length >= 8 && phoneRegex.test(v)), "Numéro de téléphone invalide (ex. +509 3712-3456).")
  .optional();

export const loginSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(1, "Entrez votre mot de passe."),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Indiquez votre nom complet.").max(120),
  email: z.string().trim().email("Adresse e-mail invalide.").max(254),
  phone: optionalPhone,
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(128, "Le mot de passe ne peut pas dépasser 128 caractères."),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions pour créer un compte." }) }),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Indiquez votre nom complet.").max(120),
  phone: optionalPhone,
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Entrez votre mot de passe actuel."),
    newPassword: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(128, "Le mot de passe ne peut pas dépasser 128 caractères."),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Les deux mots de passe ne correspondent pas." });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
