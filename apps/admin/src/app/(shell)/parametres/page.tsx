"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { ApiError, put } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import type { BillingSettings } from "@/lib/types";

export default function SettingsPage() {
  return (
    <Gate perm="billing.settings">
      <Loader />
    </Gate>
  );
}

function Loader() {
  const { data, loading, error, reload } = useFetch<BillingSettings>("/admin/billing/settings");
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-96" />;
  return data ? <Form initial={data} onSaved={reload} /> : null;
}

const prefix = z.string().trim().min(2, "2 à 6 caractères.").max(6, "2 à 6 caractères.").regex(/^[A-Za-z0-9]+$/, "Lettres et chiffres uniquement.");
const required = (label: string) => z.string().trim().min(1, `${label} requis.`);
const schema = z.object({
  legalName: z.string().trim().min(2, "Raison sociale requise."),
  address: z.string().trim().min(2, "Adresse requise."),
  city: required("Ville"),
  country: required("Pays"),
  phone: required("Téléphone"),
  email: z.string().trim().email("E-mail invalide."),
  defaultCurrency: z.enum(["HTG", "USD"], { message: "HTG ou USD." }),
  defaultTaxRate: z.coerce.number().min(0, "Entre 0 et 100.").max(100, "Entre 0 et 100."),
  paymentTermsDays: z.coerce.number().int().min(0, "Nombre de jours ≥ 0."),
  quoteValidityDays: z.coerce.number().int().min(1, "Au moins 1 jour."),
  quote: prefix,
  proforma: prefix,
  invoice: prefix,
});

function Form({ initial, onSaved }: { initial: BillingSettings; onSaved: () => void }) {
  const [s, setS] = React.useState({
    legalName: initial.legalName,
    address: initial.address,
    city: initial.city ?? "",
    country: initial.country ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    website: initial.website ?? "",
    taxId: initial.taxId ?? "",
    defaultCurrency: initial.defaultCurrency,
    defaultTaxRate: String(initial.defaultTaxRate),
    paymentTermsDays: String(initial.paymentTermsDays),
    quoteValidityDays: String(initial.quoteValidityDays),
    quote: initial.prefixes.quote,
    proforma: initial.prefixes.proforma,
    invoice: initial.prefixes.invoice,
    bankDetails: initial.bankDetails ?? "",
    paymentInstructions: initial.paymentInstructions ?? "",
    defaultTerms: initial.defaultTerms ?? "",
    footerNote: initial.footerNote ?? "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS((p) => ({ ...p, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(s);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      toast.error("Corrigez les champs signalés.");
      return;
    }
    setErrors({});
    setBusy(true);
    const nz = (v: string) => (v.trim() === "" ? null : v.trim());
    try {
      await put("/admin/billing/settings", {
        legalName: parsed.data.legalName,
        address: parsed.data.address,
        city: parsed.data.city,
        country: parsed.data.country,
        phone: parsed.data.phone,
        email: parsed.data.email,
        website: nz(s.website),
        taxId: nz(s.taxId),
        defaultCurrency: parsed.data.defaultCurrency.toUpperCase(),
        defaultTaxRate: parsed.data.defaultTaxRate,
        paymentTermsDays: parsed.data.paymentTermsDays,
        quoteValidityDays: parsed.data.quoteValidityDays,
        prefixes: { quote: parsed.data.quote.toUpperCase(), proforma: parsed.data.proforma.toUpperCase(), invoice: parsed.data.invoice.toUpperCase() },
        bankDetails: nz(s.bankDetails),
        paymentInstructions: nz(s.paymentInstructions),
        defaultTerms: nz(s.defaultTerms),
        footerNote: nz(s.footerNote),
      });
      toast.success("Paramètres enregistrés.");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors()).length) setErrors(err.fieldErrors());
      toast.error(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        title="Paramètres"
        subtitle="Informations de l'entreprise et réglages de facturation."
        actions={
          <Button type="submit" variant="sun" disabled={busy} data-testid="settings-save">
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-bold">Entreprise</h2>
          <Field id="s-legal" label="Raison sociale" required error={errors.legalName}>
            <Input id="s-legal" value={s.legalName} onChange={set("legalName")} data-testid="set-legalName" />
          </Field>
          <Field id="s-addr" label="Adresse" required error={errors.address}>
            <Input id="s-addr" value={s.address} onChange={set("address")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="s-city" label="Ville" required error={errors.city}>
              <Input id="s-city" value={s.city} onChange={set("city")} />
            </Field>
            <Field id="s-country" label="Pays" required error={errors.country}>
              <Input id="s-country" value={s.country} onChange={set("country")} />
            </Field>
            <Field id="s-phone" label="Téléphone" required error={errors.phone}>
              <Input id="s-phone" value={s.phone} onChange={set("phone")} />
            </Field>
            <Field id="s-email" label="E-mail" required error={errors.email}>
              <Input id="s-email" type="email" value={s.email} onChange={set("email")} />
            </Field>
            <Field id="s-web" label="Site web">
              <Input id="s-web" value={s.website} onChange={set("website")} />
            </Field>
            <Field id="s-tax" label="N° fiscal">
              <Input id="s-tax" value={s.taxId} onChange={set("taxId")} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-bold">Facturation</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field id="s-cur" label="Devise par défaut" error={errors.defaultCurrency}>
              <Select id="s-cur" value={s.defaultCurrency} onChange={(e) => setS((p) => ({ ...p, defaultCurrency: e.target.value }))}>
                <option value="HTG">HTG — gourde</option>
                <option value="USD">USD — dollar</option>
              </Select>
            </Field>
            <Field id="s-tax-rate" label="Taxe par défaut (%)" error={errors.defaultTaxRate}>
              <Input id="s-tax-rate" inputMode="decimal" value={s.defaultTaxRate} onChange={set("defaultTaxRate")} data-testid="set-taxRate" />
            </Field>
            <Field id="s-terms-days" label="Délai de paiement (jours)" error={errors.paymentTermsDays}>
              <Input id="s-terms-days" inputMode="numeric" value={s.paymentTermsDays} onChange={set("paymentTermsDays")} />
            </Field>
            <Field id="s-valid" label="Validité des devis (jours)" error={errors.quoteValidityDays}>
              <Input id="s-valid" inputMode="numeric" value={s.quoteValidityDays} onChange={set("quoteValidityDays")} />
            </Field>
          </div>
          <h3 className="pt-2 font-semibold">Numérotation</h3>
          <p className="text-xs text-ip-muted">Format : PRÉFIXE-ANNÉE-0001, remise à zéro chaque année. Les numéros déjà attribués ne changent pas.</p>
          <div className="grid grid-cols-3 gap-3">
            <Field id="s-p-q" label="Devis" error={errors.quote}>
              <Input id="s-p-q" value={s.quote} onChange={set("quote")} data-testid="set-prefix-quote" />
            </Field>
            <Field id="s-p-p" label="Proforma" error={errors.proforma}>
              <Input id="s-p-p" value={s.proforma} onChange={set("proforma")} />
            </Field>
            <Field id="s-p-i" label="Facture" error={errors.invoice}>
              <Input id="s-p-i" value={s.invoice} onChange={set("invoice")} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <h2 className="font-heading text-lg font-bold">Paiement & conditions</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field id="s-bank" label="Coordonnées bancaires" hint="Imprimées sur les factures.">
              <Textarea id="s-bank" value={s.bankDetails} onChange={set("bankDetails")} />
            </Field>
            <Field id="s-pay" label="Instructions de paiement (MonCash, Zelle…)">
              <Textarea id="s-pay" value={s.paymentInstructions} onChange={set("paymentInstructions")} />
            </Field>
            <Field id="s-conditions" label="Conditions par défaut">
              <Textarea id="s-conditions" value={s.defaultTerms} onChange={set("defaultTerms")} />
            </Field>
            <Field id="s-footer" label="Note de bas de page">
              <Textarea id="s-footer" value={s.footerNote} onChange={set("footerNote")} />
            </Field>
          </div>
        </Card>
      </div>
    </form>
  );
}
