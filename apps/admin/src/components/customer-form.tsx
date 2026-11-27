"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/kit";
import { ApiError, patch, post } from "@/lib/api";
import type { Customer } from "@/lib/types";

const schema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court."),
  email: z.string().trim().email("E-mail invalide."),
  company: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/** Create / edit customer dialog. Calls POST /admin/customers or PATCH /admin/customers/:id. */
export function CustomerFormDialog({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer?: Customer | null; onSaved: (c: Customer) => void }) {
  const [v, setV] = React.useState({ fullName: "", email: "", company: "", phone: "", address: "", city: "", country: "HT", taxId: "", notes: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open)
      setV({
        fullName: customer?.fullName ?? "",
        email: customer?.email ?? "",
        company: customer?.company ?? "",
        phone: customer?.phone ?? "",
        address: customer?.address ?? "",
        city: customer?.city ?? "",
        country: customer?.country ?? "HT",
        taxId: customer?.taxId ?? "",
        notes: customer?.notes ?? "",
      });
    setErrors({});
  }, [open, customer]);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(parsed.data).map(([k, val]) => [k, val === "" ? null : val]));
      const saved = customer ? await patch<Customer>(`/admin/customers/${customer.id}`, body) : await post<Customer>("/admin/customers", body);
      toast.success(customer ? "Client mis à jour." : "Client créé.");
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      else if (err instanceof ApiError && err.status === 409) setErrors({ email: "Un client existe déjà avec cet e-mail." });
      else toast.error(err instanceof ApiError ? err.message : "Échec de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? "Modifier le client" : "Nouveau client"}
      testId="customer-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="customer-form" disabled={busy} data-testid="customer-save">
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <Field id="c-name" label="Nom complet" error={errors.fullName} required>
          <Input id="c-name" value={v.fullName} onChange={set("fullName")} aria-invalid={Boolean(errors.fullName)} />
        </Field>
        <Field id="c-email" label="E-mail" error={errors.email} required>
          <Input id="c-email" type="email" value={v.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field id="c-company" label="Société" error={errors.company}>
          <Input id="c-company" value={v.company} onChange={set("company")} />
        </Field>
        <Field id="c-phone" label="Téléphone" error={errors.phone}>
          <Input id="c-phone" value={v.phone} onChange={set("phone")} />
        </Field>
        <Field id="c-address" label="Adresse" error={errors.address} className="sm:col-span-2">
          <Input id="c-address" value={v.address} onChange={set("address")} />
        </Field>
        <Field id="c-city" label="Ville" error={errors.city}>
          <Input id="c-city" value={v.city} onChange={set("city")} />
        </Field>
        <Field id="c-country" label="Pays (code)" error={errors.country}>
          <Input id="c-country" value={v.country} onChange={set("country")} maxLength={2} />
        </Field>
        <Field id="c-tax" label="N° fiscal / NIF" error={errors.taxId}>
          <Input id="c-tax" value={v.taxId} onChange={set("taxId")} />
        </Field>
        <Field id="c-notes" label="Notes internes" error={errors.notes} className="sm:col-span-2">
          <Textarea id="c-notes" value={v.notes} onChange={set("notes")} className="min-h-20" />
        </Field>
      </form>
    </Dialog>
  );
}
