"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { ApiError, get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DOC_TYPE, money, today } from "@/lib/format";
import { useDebounced, useFetch } from "@/lib/hooks";
import { documentWritePerm } from "@/lib/permissions";
import { computeTotals } from "@/lib/totals";
import type { AdminProduct, BillingDocument, BillingSettings, Customer, DocumentType, OrderDetail } from "@/lib/types";

interface LineForm {
  key: string;
  description: string;
  sku: string;
  productId: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
}
const newLine = (): LineForm => ({ key: Math.random().toString(36).slice(2), description: "", sku: "", productId: null, quantity: "1", unit: "", unitPrice: "0", discountPercent: "0" });

const lineSchema = z.object({
  description: z.string().trim().min(1, "Description requise."),
  quantity: z.coerce.number().gt(0, "Quantité > 0."),
  unitPrice: z.coerce.number().min(0, "Prix ≥ 0."),
  discountPercent: z.coerce.number().min(0, "0 à 100.").max(100, "0 à 100."),
});
const customerSchema = z.object({ name: z.string().trim().min(2, "Nom requis."), email: z.string().trim().email("E-mail invalide.") });

/** Create / edit a quote, proforma or invoice. Drafts are fully editable; sent documents only allow a few fields. */
export function DocumentEditor({ documentId }: { documentId?: string }) {
  const sp = useSearchParams();
  const type = (sp.get("type") as DocumentType | null) ?? "QUOTE";
  const existing = useFetch<BillingDocument>(documentId ? `/admin/documents/${documentId}` : null);
  const t: DocumentType = existing.data?.type ?? (["QUOTE", "PROFORMA", "INVOICE"].includes(type) ? type : "QUOTE");
  return (
    <Gate perm={documentWritePerm(t)}>
      {documentId && existing.error ? (
        <ErrorState message={existing.error.message} onRetry={existing.reload} />
      ) : documentId && !existing.data ? (
        <Skeleton className="h-64" />
      ) : (
        <Inner type={t} doc={existing.data} />
      )}
    </Gate>
  );
}

function Inner({ type, doc }: { type: DocumentType; doc: BillingDocument | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { can } = useAuth();
  const orderId = sp.get("orderId");
  const customerIdParam = sp.get("customerId");
  const locked = doc ? doc.status !== "DRAFT" : false;
  const fullyLocked = locked && doc?.type === "INVOICE";

  // Create-from-order: the server prefills the lines from the order snapshot, so we only confirm and create the draft.
  const order = useFetch<OrderDetail>(!doc && orderId ? `/admin/orders/${orderId}` : null);
  const preCustomer = useFetch<Customer>(!doc && customerIdParam ? `/admin/customers/${customerIdParam}` : null);
  const settings = useFetch<BillingSettings>(can("billing.settings") && !doc ? "/admin/billing/settings" : null);

  const [cust, setCust] = React.useState({ id: doc?.customerId ?? "", name: doc?.customer.name ?? "", company: doc?.customer.company ?? "", email: doc?.customer.email ?? "", phone: doc?.customer.phone ?? "", address: doc?.customer.address ?? "", city: doc?.customer.city ?? "", country: doc?.customer.country ?? "HT", taxId: doc?.customer.taxId ?? "" });
  const [currency, setCurrency] = React.useState(doc?.currency ?? "HTG");
  const [issueDate, setIssueDate] = React.useState(doc?.issueDate?.slice(0, 10) ?? today());
  const [dueDate, setDueDate] = React.useState(doc?.dueDate?.slice(0, 10) ?? "");
  const [validUntil, setValidUntil] = React.useState(doc?.validUntil?.slice(0, 10) ?? "");
  const [lines, setLines] = React.useState<LineForm[]>(
    doc ? doc.lines.map((l) => ({ key: l.id ?? Math.random().toString(36).slice(2), description: l.description, sku: l.sku ?? "", productId: l.productId ?? null, quantity: String(l.quantity), unit: l.unit ?? "", unitPrice: l.unitPrice, discountPercent: String(l.discountPercent) })) : [newLine()],
  );
  const [discountAmount, setDiscountAmount] = React.useState(doc?.discountAmount ?? "0");
  const [shippingAmount, setShippingAmount] = React.useState(doc?.shippingAmount ?? "0");
  const [taxRate, setTaxRate] = React.useState(String(doc?.taxRate ?? 0));
  const [notes, setNotes] = React.useState(doc?.notes ?? "");
  const [internalNotes, setInternalNotes] = React.useState(doc?.internalNotes ?? "");
  const [terms, setTerms] = React.useState(doc?.terms ?? "");
  const [paymentInstructions, setPaymentInstructions] = React.useState(doc?.paymentInstructions ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  // Defaults for a brand-new document (only when the role may read the billing settings).
  const defaultsApplied = React.useRef(false);
  React.useEffect(() => {
    const s = settings.data;
    if (!s || doc || defaultsApplied.current) return;
    defaultsApplied.current = true;
    setCurrency(s.defaultCurrency);
    setTaxRate(String(s.defaultTaxRate));
    setTerms(s.defaultTerms ?? "");
    setPaymentInstructions(s.paymentInstructions ?? "");
    const d = new Date();
    if (type === "INVOICE") d.setDate(d.getDate() + s.paymentTermsDays);
    else d.setDate(d.getDate() + s.quoteValidityDays);
    const iso = d.toISOString().slice(0, 10);
    if (type === "INVOICE") setDueDate(iso);
    else setValidUntil(iso);
  }, [settings.data, doc, type]);

  React.useEffect(() => {
    const c = preCustomer.data;
    if (c && !cust.id && !doc)
      setCust({ id: c.id, name: c.fullName, company: c.company ?? "", email: c.email, phone: c.phone ?? "", address: c.address ?? "", city: c.city ?? "", country: c.country ?? "HT", taxId: c.taxId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preCustomer.data]);

  const totals = React.useMemo(
    () => computeTotals({ lines: lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discountPercent: l.discountPercent })), discountAmount, shippingAmount, taxRate, payments: doc?.payments.filter((p) => !p.voidedAt).map((p) => p.amount) }),
    [lines, discountAmount, shippingAmount, taxRate, doc],
  );

  const setLine = (key: string, patchLine: Partial<LineForm>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patchLine } : l)));
  const move = (i: number, d: -1 | 1) =>
    setLines((ls) => {
      const j = i + d;
      if (j < 0 || j >= ls.length) return ls;
      const c = [...ls];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  async function createFromOrder() {
    setBusy(true);
    try {
      const d = await post<BillingDocument>("/admin/documents", { type, orderId });
      toast.success(`${d.number} créé à partir de la commande.`);
      router.replace(`/documents/${d.id}/edit`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Création impossible.");
      setBusy(false);
    }
  }

  async function save() {
    const errs: Record<string, string> = {};
    if (!locked) {
      const c = customerSchema.safeParse({ name: cust.name, email: cust.email });
      if (!c.success) for (const i of c.error.issues) errs[`customer.${i.path[0]}`] = i.message;
      if (lines.length === 0) errs.lines = "Ajoutez au moins une ligne.";
      lines.forEach((l, i) => {
        const r = lineSchema.safeParse(l);
        if (!r.success) for (const is of r.error.issues) errs[`lines.${i}.${is.path[0]}`] = is.message;
      });
      if (Number(taxRate) < 0 || Number(taxRate) > 100) errs.taxRate = "0 à 100.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Corrigez les champs en rouge avant d'enregistrer.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = locked
        ? { notes: notes || null, terms: terms || null, dueDate: dueDate || null, validUntil: validUntil || null }
        : {
            // `type` is create-only: the API rejects it on PATCH (forbidNonWhitelisted).
            ...(doc ? {} : { type }),
            ...(cust.id ? { customerId: cust.id } : {}),
            customer: { name: cust.name, company: cust.company || null, email: cust.email, phone: cust.phone || null, address: cust.address || null, city: cust.city || null, country: cust.country || null, taxId: cust.taxId || null },
            ...(orderId && !doc ? { orderId } : {}),
            currency,
            issueDate,
            dueDate: dueDate || null,
            validUntil: validUntil || null,
            lines: lines.map((l) => ({ description: l.description, sku: l.sku || null, productId: l.productId, quantity: Number(l.quantity), unit: l.unit || null, unitPrice: Number(l.unitPrice).toFixed(2), discountPercent: Number(l.discountPercent) })),
            discountAmount: Number(discountAmount || 0).toFixed(2),
            shippingAmount: Number(shippingAmount || 0).toFixed(2),
            taxRate: Number(taxRate || 0),
            notes: notes || null,
            internalNotes: internalNotes || null,
            terms: terms || null,
            paymentInstructions: paymentInstructions || null,
          };
      const saved = doc ? await patch<BillingDocument>(`/admin/documents/${doc.id}`, body) : await post<BillingDocument>("/admin/documents", body);
      toast.success(doc ? "Document enregistré." : `${saved.number} créé (brouillon).`);
      router.push(`/documents/${saved.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fieldErrors());
        toast.error("Certains champs sont invalides.");
      } else toast.error(e instanceof ApiError ? e.message : "Échec de l'enregistrement.");
      setBusy(false);
    }
  }

  // ---- create-from-order confirmation step
  if (!doc && orderId) {
    return (
      <>
        <PageHeader title={`Nouveau ${DOC_TYPE[type].label.toLowerCase()}`} />
        {order.error ? (
          <ErrorState message={order.error.message} onRetry={order.reload} />
        ) : !order.data ? (
          <Skeleton className="h-40" />
        ) : (
          <Card className="max-w-2xl" data-testid="from-order">
            <p className="text-sm">
              Un brouillon sera créé à partir de la commande <strong>{order.data.reference}</strong> : les lignes (produits, quantités, prix) et le client sont repris automatiquement ; vous pourrez ensuite les modifier.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {order.data.items.map((i) => (
                <li key={i.id}>
                  {i.quantity} × {i.productName} — {money(i.lineTotal, order.data!.currency)}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <Button variant="sun" onClick={createFromOrder} disabled={busy} data-testid="create-from-order">
                {busy ? <Loader2 className="animate-spin" /> : <Plus />} Créer le brouillon
              </Button>
              <Link href={`/commandes/${orderId}`} className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold hover:bg-ip-mist">
                Annuler
              </Link>
            </div>
          </Card>
        )}
      </>
    );
  }

  if (fullyLocked)
    return (
      <>
        <PageHeader title={doc!.number} />
        <ErrorState message="Une facture envoyée n'est plus modifiable. Annulez-la (avec un motif) puis émettez-en une nouvelle." />
        <Link href={`/documents/${doc!.id}`} className="mt-4 inline-block text-sm font-semibold text-ip-teal underline">
          Retour à la facture
        </Link>
      </>
    );

  return (
    <>
      <PageHeader
        title={doc ? `Modifier ${doc.number}` : `Nouveau ${DOC_TYPE[type].label.toLowerCase()}`}
        subtitle={locked ? "Document envoyé : seuls les notes, conditions et échéances sont modifiables." : undefined}
        actions={
          <>
            <Link href={doc ? `/documents/${doc.id}` : DOC_TYPE[type].path} className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold hover:bg-ip-mist">
              Annuler
            </Link>
            <Button variant="sun" onClick={save} disabled={busy} data-testid="doc-save">
              {busy ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer le brouillon
            </Button>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {!locked && (
            <Card>
              <h2 className="mb-3 font-heading text-lg font-bold">Client</h2>
              <CustomerPicker
                onPick={(c) => setCust({ id: c.id, name: c.fullName, company: c.company ?? "", email: c.email, phone: c.phone ?? "", address: c.address ?? "", city: c.city ?? "", country: c.country ?? "HT", taxId: c.taxId ?? "" })}
                canSearch={can("customers.read")}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field id="d-name" label="Nom" error={errors["customer.name"]} required>
                  <Input id="d-name" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value, id: cust.id })} aria-invalid={Boolean(errors["customer.name"])} />
                </Field>
                <Field id="d-email" label="E-mail" error={errors["customer.email"]} required>
                  <Input id="d-email" type="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} aria-invalid={Boolean(errors["customer.email"])} />
                </Field>
                <Field id="d-company" label="Société">
                  <Input id="d-company" value={cust.company} onChange={(e) => setCust({ ...cust, company: e.target.value })} />
                </Field>
                <Field id="d-phone" label="Téléphone">
                  <Input id="d-phone" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
                </Field>
                <Field id="d-address" label="Adresse" className="sm:col-span-2">
                  <Input id="d-address" value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                </Field>
                <Field id="d-city" label="Ville">
                  <Input id="d-city" value={cust.city} onChange={(e) => setCust({ ...cust, city: e.target.value })} />
                </Field>
                <Field id="d-tax" label="N° fiscal client">
                  <Input id="d-tax" value={cust.taxId} onChange={(e) => setCust({ ...cust, taxId: e.target.value })} />
                </Field>
              </div>
            </Card>
          )}

          {!locked && (
            <Card>
              <h2 className="mb-3 font-heading text-lg font-bold">Lignes</h2>
              {errors.lines && <p role="alert" className="mb-2 text-sm text-red-700">{errors.lines}</p>}
              <div className="space-y-3" data-testid="lines">
                {lines.map((l, i) => (
                  <div key={l.key} className="rounded-xl border border-ip-line p-3" data-testid="line-row">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Field id={`l-desc-${i}`} label="Description" error={errors[`lines.${i}.description`]}>
                        <Textarea id={`l-desc-${i}`} value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} className="min-h-14" aria-invalid={Boolean(errors[`lines.${i}.description`])} />
                      </Field>
                      <div className="flex items-start gap-1 sm:pt-6">
                        <Button variant="ghost" size="icon" aria-label="Monter la ligne" disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Descendre la ligne" disabled={i === lines.length - 1} onClick={() => move(i, 1)}>
                          <ArrowDown />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Supprimer la ligne" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} data-testid="line-remove">
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <Field id={`l-qty-${i}`} label="Quantité" error={errors[`lines.${i}.quantity`]}>
                        <Input id={`l-qty-${i}`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} data-testid="line-qty" />
                      </Field>
                      <Field id={`l-unit-${i}`} label="Unité">
                        <Input id={`l-unit-${i}`} value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} placeholder="pièce" />
                      </Field>
                      <Field id={`l-price-${i}`} label="Prix unitaire" error={errors[`lines.${i}.unitPrice`]}>
                        <Input id={`l-price-${i}`} inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} data-testid="line-price" />
                      </Field>
                      <Field id={`l-disc-${i}`} label="Remise %" error={errors[`lines.${i}.discountPercent`]}>
                        <Input id={`l-disc-${i}`} inputMode="decimal" value={l.discountPercent} onChange={(e) => setLine(l.key, { discountPercent: e.target.value })} />
                      </Field>
                      <div className="flex flex-col justify-end pb-2 text-right">
                        <span className="text-xs text-ip-muted">Total ligne</span>
                        <span className="font-semibold tabular-nums" data-testid="line-total">
                          {money(totals.lineTotals[i] ?? "0", currency)}
                        </span>
                      </div>
                    </div>
                    <ProductPicker onPick={(p) => setLine(l.key, { description: l.description ? `${l.description}\n${p.name}` : p.name, productId: p.id, sku: p.slug, unitPrice: p.basePrice, unit: p.unitLabel })} canSearch={can("products.read")} />
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLines((ls) => [...ls, newLine()])} data-testid="line-add">
                <Plus /> Ajouter une ligne
              </Button>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-heading text-lg font-bold">Notes et conditions</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="d-notes" label="Note pour le client (visible sur le document)">
                <Textarea id="d-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              {!locked && (
                <Field id="d-internal" label="Note interne (jamais envoyée)">
                  <Textarea id="d-internal" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
                </Field>
              )}
              <Field id="d-terms" label="Conditions">
                <Textarea id="d-terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
              </Field>
              {!locked && (
                <Field id="d-pay" label="Instructions de paiement">
                  <Textarea id="d-pay" value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} />
                </Field>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <h2 className="mb-3 font-heading text-lg font-bold">Paramètres</h2>
            <div className="space-y-3">
              {!locked && (
                <>
                  <Field id="d-cur" label="Devise">
                    <Select id="d-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="HTG">HTG — gourde</option>
                      <option value="USD">USD — dollar</option>
                    </Select>
                  </Field>
                  <Field id="d-issue" label="Date d'émission">
                    <Input id="d-issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                  </Field>
                </>
              )}
              {type === "INVOICE" ? (
                <Field id="d-due" label="Échéance">
                  <Input id="d-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
              ) : (
                <Field id="d-valid" label="Valable jusqu'au">
                  <Input id="d-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </Field>
              )}
              {!locked && (
                <>
                  <Field id="d-disc" label={`Remise globale (${currency})`}>
                    <Input id="d-disc" inputMode="decimal" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} data-testid="doc-discount" />
                  </Field>
                  <Field id="d-ship" label={`Livraison (${currency})`}>
                    <Input id="d-ship" inputMode="decimal" value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} data-testid="doc-shipping" />
                  </Field>
                  <Field id="d-tax-rate" label="Taxe (%)" error={errors.taxRate}>
                    <Input id="d-tax-rate" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} data-testid="doc-tax" />
                  </Field>
                </>
              )}
            </div>
          </Card>
          <Card data-testid="totals">
            <h2 className="mb-3 font-heading text-lg font-bold">Totaux</h2>
            <dl className="space-y-1.5 text-sm">
              <Row label="Sous-total" value={money(totals.subtotal, currency)} id="t-subtotal" />
              <Row label="Remise" value={`− ${money(totals.discountTotal, currency)}`} />
              <Row label="Livraison" value={money(Number(shippingAmount || 0), currency)} />
              <Row label={`Taxe (${taxRate || 0} %)`} value={money(totals.taxTotal, currency)} id="t-tax" />
              <div className="border-t border-ip-line pt-2">
                <Row label="Total" value={money(totals.total, currency)} strong id="t-total" />
              </div>
              {doc && Number(totals.amountPaid) > 0 && <Row label="Déjà payé" value={money(totals.amountPaid, currency)} />}
              {doc && type === "INVOICE" && <Row label="Solde" value={money(totals.balance, currency)} strong />}
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value, strong, id }: { label: string; value: string; strong?: boolean; id?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? "font-semibold" : "text-ip-muted"}>{label}</dt>
      <dd data-testid={id} className={strong ? "font-heading text-lg font-bold tabular-nums" : "tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}

function CustomerPicker({ onPick, canSearch }: { onPick: (c: Customer) => void; canSearch: boolean }) {
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q);
  const { data } = useFetch<Customer[]>(canSearch && dq.length >= 2 ? "/admin/customers" : null, { q: dq, pageSize: 6 });
  if (!canSearch) return <p className="text-xs text-ip-muted">Saisissez les coordonnées du client ci-dessous.</p>;
  return (
    <div className="relative">
      <Field id="d-search" label="Choisir un client existant" hint="Tapez au moins 2 lettres, ou saisissez un nouveau client ci-dessous.">
        <Input id="d-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, société ou e-mail" data-testid="customer-picker" />
      </Field>
      {data && data.length > 0 && q.length >= 2 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-ip-line bg-white p-1 shadow-xl" role="listbox">
          {data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-ip-mist"
                onClick={() => {
                  onPick(c);
                  setQ("");
                }}
              >
                <span className="font-semibold">{c.fullName}</span>
                <span className="text-xs text-ip-muted">{[c.company, c.email].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductPicker({ onPick, canSearch }: { onPick: (p: AdminProduct) => void; canSearch: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q);
  const { data } = useFetch<AdminProduct[]>(open && canSearch ? "/admin/products" : null, { q: dq, status: "ACTIVE", pageSize: 8 });
  if (!canSearch) return null;
  return (
    <div className="mt-2">
      <button type="button" className="text-xs font-semibold text-ip-teal underline" onClick={() => setOpen((o) => !o)} data-testid="product-pick-toggle">
        {open ? "Fermer le catalogue" : "Remplir depuis le catalogue"}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-ip-mist p-2">
          <Input aria-label="Rechercher un produit" placeholder="Rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-1 max-h-44 overflow-y-auto">
            {(data ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white"
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                  data-testid="product-option"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-ip-muted tabular-nums">{money(p.basePrice, p.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Re-exported so pages can prefetch defaults without importing the whole editor.
export async function fetchCustomer(id: string) {
  return get<Customer>(`/admin/customers/${id}`);
}
