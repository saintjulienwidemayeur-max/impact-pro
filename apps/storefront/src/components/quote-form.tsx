"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { LogoUploader } from "./logo-uploader";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/field";
import type { UploadedLogo } from "@/lib/api";
import { fieldErrors, quoteSchema } from "@/lib/schemas";

type Errors = Record<string, string>;

export function QuoteForm({ fromCart = false }: { fromCart?: boolean }) {
  const { lines, ready } = useCart();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [logo, setLogo] = React.useState<UploadedLogo | null>(null);
  const prefilled = React.useRef(false);

  // Prefill products/quantity from the cart when coming from /panier
  React.useEffect(() => {
    if (!fromCart || !ready || prefilled.current || lines.length === 0 || !formRef.current) return;
    prefilled.current = true;
    const products = formRef.current.elements.namedItem("products") as HTMLTextAreaElement | null;
    const quantity = formRef.current.elements.namedItem("quantity") as HTMLInputElement | null;
    if (products) products.value = lines.map((l) => `${l.productName} × ${l.quantity}`).join("\n");
    if (quantity) quantity.value = String(lines.reduce((n, l) => n + l.quantity, 0));
  }, [fromCart, ready, lines]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const values = Object.fromEntries(
      ["name", "company", "phone", "email", "products", "quantity", "message", "logoUploadId"].map((k) => [k, data.get(k)?.toString() ?? ""]),
    );
    const parsed = quoteSchema.safeParse(values);
    const next: Errors = parsed.success ? {} : fieldErrors(parsed.error);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0];
      (form.elements.namedItem(firstKey) as HTMLElement | null)?.focus();
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => null)) as
        | { data?: { reference: string }; error?: { message?: string; fields?: Errors } }
        | null;
      if (!res.ok || !body?.data) {
        if (body?.error?.fields) setErrors(body.error.fields);
        throw new Error(body?.error?.message ?? "Envoi impossible pour le moment.");
      }
      setDone(body.data.reference);
      toast.success("Demande de devis envoyée !", { description: `Référence : ${body.data.reference}` });
      form.reset();
      setLogo(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col items-center rounded-[var(--radius-card)] border border-ip-line bg-ip-mist px-6 py-14 text-center">
        <CheckCircle2 className="size-12 text-ip-teal" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-semibold">Merci, votre demande est bien reçue !</h2>
        <p className="mt-1 text-sm text-ip-muted">
          Référence <strong className="text-ip-ink">{done}</strong>. Un conseiller Impact Pro vous contacte sous 24 h ouvrées.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => setDone(null)}>
            Nouvelle demande
          </Button>
          <Link href="/produits" className="inline-flex h-11 items-center rounded-xl bg-ip-sun px-5 text-sm font-semibold text-ip-ink hover:bg-ip-sun-600">
            Continuer mes achats
          </Link>
        </div>
      </div>
    );
  }

  const describedBy = (id: string) => ({ "aria-describedby": `${id}-msg`, "aria-invalid": Boolean(errors[id]) });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2" aria-label="Demande de devis">
      <Field id="name" label="Nom complet" required error={errors.name}>
        <Input id="name" name="name" autoComplete="name" {...describedBy("name")} />
      </Field>
      <Field id="company" label="Entreprise / organisation" error={errors.company}>
        <Input id="company" name="company" autoComplete="organization" {...describedBy("company")} />
      </Field>
      <Field id="phone" label="Téléphone" required error={errors.phone} hint="ex. +509 3X XX XXXX">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" {...describedBy("phone")} />
      </Field>
      <Field id="email" label="Courriel" required error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" {...describedBy("email")} />
      </Field>
      <Field id="products" label="Produits souhaités" required error={errors.products} className="sm:col-span-2" hint="Ex. 50 polos teal brodés, 100 tasses…">
        <Textarea id="products" name="products" rows={3} {...describedBy("products")} />
      </Field>
      <Field id="quantity" label="Quantité totale" required error={errors.quantity}>
        <Input id="quantity" name="quantity" type="number" min={1} inputMode="numeric" {...describedBy("quantity")} />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-1.5 text-sm font-medium text-ip-ink">
          <label htmlFor="quote-logo">Votre logo (optionnel)</label>
        </p>
        <LogoUploader id="quote-logo" value={logo} onChange={setLogo} error={errors.logoUploadId} />
        <input type="hidden" name="logoUploadId" value={logo?.id ?? ""} />
      </div>
      <Field id="message" label="Message" error={errors.message} className="sm:col-span-2" hint="Couleurs, délais, adresse de livraison…">
        <Textarea id="message" name="message" rows={4} {...describedBy("message")} />
      </Field>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ip-muted">* Champs obligatoires. Vos données servent uniquement à préparer votre devis.</p>
        <Button type="submit" variant="sun" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Envoyer ma demande
        </Button>
      </div>
    </form>
  );
}
