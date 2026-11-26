import { z } from "zod";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "application/pdf"] as const;

export const newsletterSchema = z.object({
  email: z.string().trim().email("Adresse courriel invalide."),
});

const phoneRegex = /^\+?[0-9 ()-]{8,20}$/;

export const quoteSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().regex(phoneRegex, "Numéro de téléphone invalide."),
  email: z.string().trim().email("Adresse courriel invalide."),
  products: z.string().trim().min(2, "Indiquez les produits souhaités.").max(2000),
  quantity: z.coerce
    .number({ invalid_type_error: "Indiquez une quantité." })
    .int("Quantité entière uniquement.")
    .min(1, "La quantité minimale est 1.")
    .max(1_000_000),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.string().trim().email("Adresse courriel invalide."),
  subject: z.string().trim().min(2, "Indiquez un sujet.").max(200),
  message: z.string().trim().min(10, "Votre message doit contenir au moins 10 caractères.").max(4000),
});

/** Validates an uploaded logo file. Returns an error message or null. */
export function validateUpload(file: { size: number; type: string } | null | undefined): string | null {
  if (!file || file.size === 0) return null;
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return "Format accepté : PNG, JPG, SVG, WEBP ou PDF.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Le fichier dépasse 10 Mo.";
  return null;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
