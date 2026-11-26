"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Lock, ShoppingCart, Store, Truck } from "lucide-react";
import { useCart } from "./cart-provider";
import { CartLineSummary } from "./cart-view";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/field";
import { ApiError, createCustomOrder, detailsToFields, friendlyError, type DeliveryMethod } from "@/lib/api";
import { checkoutSchema, fieldErrors } from "@/lib/schemas";
import { cn, formatHTG } from "@/lib/utils";

type Errors = Record<string, string>;

const FIELDS = ["fullName", "company", "phone", "email", "city", "address", "notes"] as const;

/** Maps API validation paths (customer.email, items.0.quantity…) onto form fields / a general message. */
function mapApiFields(fields: Record<string, string>): { form: Errors; items: string[] } {
  const form: Errors = {};
  const items: string[] = [];
  for (const [path, msg] of Object.entries(fields)) {
    const key = path.replace(/^customer\./, "");
    if ((FIELDS as readonly string[]).includes(key)) form[key] = msg;
    else if (path === "deliveryMethod") form.deliveryMethod = msg;
    else items.push(msg);
  }
  return { form, items };
}

export function CheckoutForm() {
  const router = useRouter();
  const { lines, total, ready, clear } = useCart();
  const [delivery, setDelivery] = React.useState<DeliveryMethod>("PICKUP");
  const [errors, setErrors] = React.useState<Errors>({});
  const [general, setGeneral] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  if (!ready) return <div className="h-96 animate-pulse rounded-2xl bg-ip-mist" aria-busy="true" aria-label="Chargement" />;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-16 text-center">
        <ShoppingCart className="size-12 text-ip-teal" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold">Aucun article à commander</h2>
        <p className="mt-1 max-w-md text-sm text-ip-muted">Personnalisez d&apos;abord un article avec votre logo.</p>
        <Link href="/personnaliser" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600">
          Personnaliser un article <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const values = { ...Object.fromEntries(FIELDS.map((k) => [k, data.get(k)?.toString() ?? ""])), deliveryMethod: delivery };
    const parsed = checkoutSchema.safeParse(values);
    setGeneral(null);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      (form.elements.namedItem(Object.keys(errs)[0]) as HTMLElement | null)?.focus();
      return;
    }
    setErrors({});
    const v = parsed.data;
    setPending(true);
    try {
      const order = await createCustomOrder({
        customer: {
          fullName: v.fullName,
          company: v.company || undefined,
          phone: v.phone,
          email: v.email,
          city: v.city || undefined,
          address: v.address || undefined,
        },
        items: lines.map((l) => ({
          productSlug: l.productSlug,
          quantity: l.quantity,
          color: l.color,
          size: l.size,
          placement: l.placement,
          logoUploadId: l.logo.id,
          notes: l.notes,
        })),
        deliveryMethod: v.deliveryMethod,
        notes: v.notes || undefined,
      });
      clear();
      toast.success("Commande envoyée !", { description: `Référence ${order.reference}` });
      router.push(`/commande/confirmation?ref=${encodeURIComponent(order.reference)}&email=${encodeURIComponent(v.email)}`);
    } catch (err) {
      const msg = friendlyError(err);
      if (err instanceof ApiError && err.details) {
        const { form: formErrs, items } = mapApiFields(detailsToFields(err.details));
        if (Object.keys(formErrs).length) setErrors(formErrs);
        setGeneral(items.length && err.code === "VALIDATION_ERROR" ? `${msg} ${items.join(" ")}` : msg);
      } else {
        setGeneral(msg);
      }
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k];

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section aria-labelledby="co-contact" className="rounded-2xl border border-ip-line p-5 sm:p-6">
          <h2 id="co-contact" className="text-xl font-semibold">
            Vos coordonnées
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="fullName" label="Nom complet" required error={err("fullName")}>
              <Input id="fullName" name="fullName" autoComplete="name" aria-invalid={Boolean(err("fullName"))} aria-describedby="fullName-msg" />
            </Field>
            <Field id="company" label="Entreprise" error={err("company")} hint="Facultatif">
              <Input id="company" name="company" autoComplete="organization" aria-describedby="company-msg" />
            </Field>
            <Field id="phone" label="Téléphone" required error={err("phone")} hint="Format +509 XXXX-XXXX">
              <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+509 " aria-invalid={Boolean(err("phone"))} aria-describedby="phone-msg" />
            </Field>
            <Field id="email" label="Courriel" required error={err("email")} hint="Pour la maquette et le suivi">
              <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(err("email"))} aria-describedby="email-msg" />
            </Field>
          </div>
        </section>

        <section aria-labelledby="co-delivery" className="rounded-2xl border border-ip-line p-5 sm:p-6">
          <h2 id="co-delivery" className="text-xl font-semibold">
            Réception
          </h2>
          <div role="radiogroup" aria-labelledby="co-delivery" className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                { v: "PICKUP", icon: Store, title: "Retrait en boutique", text: "Port-au-Prince, sur rendez-vous" },
                { v: "DELIVERY", icon: Truck, title: "Livraison", text: "Frais confirmés avec votre maquette" },
              ] as const
            ).map(({ v, icon: Icon, title, text }) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={delivery === v}
                onClick={() => setDelivery(v)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                  delivery === v ? "border-ip-teal bg-ip-teal/5" : "border-ip-line hover:border-ip-teal/60",
                )}
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-ip-teal" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-xs text-ip-muted">{text}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field id="city" label="Ville" required={delivery === "DELIVERY"} error={err("city")}>
              <Input id="city" name="city" autoComplete="address-level2" aria-invalid={Boolean(err("city"))} aria-describedby="city-msg" />
            </Field>
            <Field id="address" label="Adresse" required={delivery === "DELIVERY"} error={err("address")}>
              <Input id="address" name="address" autoComplete="street-address" aria-invalid={Boolean(err("address"))} aria-describedby="address-msg" />
            </Field>
          </div>
          <Field id="notes" label="Remarques" error={err("notes")} hint="Délai souhaité, instructions…" className="mt-4">
            <Textarea id="notes" name="notes" maxLength={2000} aria-describedby="notes-msg" className="min-h-20" />
          </Field>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-ip-line bg-ip-mist p-5 sm:p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-semibold">Votre commande</h2>
        <ul className="space-y-4">
          {lines.map((l) => (
            <li key={l.id} className="border-b border-ip-line pb-4 last:border-0">
              <CartLineSummary line={l} />
              <p className="mt-2 flex justify-between text-sm">
                <span className="text-ip-muted">
                  {l.quantity} × {formatHTG(l.unitPrice)}
                </span>
                <span className="font-semibold">{formatHTG(l.lineTotal)}</span>
              </p>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-ip-line pt-3 text-base">
          <span>Total estimé</span>
          <span className="font-bold">{formatHTG(total)}</span>
        </p>
        {general && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {general}{" "}
            {/UPLOAD_NOT_FOUND|logo/i.test(general) && (
              <Link href="/panier" className="font-semibold underline">
                Retour au panier
              </Link>
            )}
          </p>
        )}
        <Button type="submit" variant="sun" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {pending ? "Envoi…" : "Confirmer la commande"}
        </Button>
        <p className="text-xs text-ip-muted">
          Aucun paiement maintenant : nous vous envoyons la maquette et le montant final, puis vous payez par MonCash, NatCash ou carte.
        </p>
      </aside>
    </form>
  );
}
