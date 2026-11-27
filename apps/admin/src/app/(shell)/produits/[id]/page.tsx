"use client";

import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui/kit";
import { ApiError, patch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import type { AdminProduct } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Nom requis."),
  basePrice: z.string().refine((v) => Number(v) > 0, "Prix supérieur à 0."),
  minQty: z.coerce.number().int().min(1, "Minimum 1."),
  tiers: z
    .array(z.object({ minQty: z.coerce.number().int().min(1, "Qté ≥ 1."), unitPrice: z.string().refine((v) => Number(v) > 0, "Prix > 0.") }))
    .min(1, "Au moins un palier.")
    .refine((t) => t.every((x, i) => i === 0 || x.minQty > t[i - 1].minQty), "Les quantités des paliers doivent être strictement croissantes."),
});

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useFetch<AdminProduct>(`/admin/products/${id}`);
  return (
    <Gate perm="products.read">
      <Link href="/produits" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ip-teal hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Produits
      </Link>
      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96" /> : data ? <Form product={data} onSaved={reload} /> : null}
    </Gate>
  );
}

function Form({ product, onSaved }: { product: AdminProduct; onSaved: () => void }) {
  const { can } = useAuth();
  const canWrite = can("products.write");
  const [name, setName] = React.useState(product.name);
  const [description, setDescription] = React.useState(product.description ?? "");
  const [status, setStatus] = React.useState(product.status);
  const [basePrice, setBasePrice] = React.useState(product.basePrice);
  const [minQty, setMinQty] = React.useState(String(product.minQty));
  const [tiers, setTiers] = React.useState(product.priceTiers.map((t) => ({ minQty: String(t.minQty), unitPrice: t.unitPrice })));
  const [colors, setColors] = React.useState(product.colors.join(", "));
  const [sizes, setSizes] = React.useState(product.sizes.join(", "));
  const [colorsRequired, setColorsRequired] = React.useState(product.colorsRequired);
  const [sizesRequired, setSizesRequired] = React.useState(product.sizesRequired);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, basePrice, minQty, tiers });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      await patch(`/admin/products/${product.id}`, {
        name: parsed.data.name,
        description,
        status,
        basePrice: Number(parsed.data.basePrice).toFixed(2),
        minQty: parsed.data.minQty,
        colors: list(colors),
        sizes: list(sizes),
        colorsRequired,
        sizesRequired,
        priceTiers: parsed.data.tiers.map((t) => ({ minQty: t.minQty, unitPrice: Number(t.unitPrice).toFixed(2) })),
      });
      toast.success("Produit enregistré.");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(err.details.flatMap((d) => d.messages));
      else setErrors([err instanceof ApiError ? err.message : "Enregistrement impossible."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        title={product.name}
        subtitle={`${product.category.name} · ${product.slug} · ${product.pricingMode === "PER_AREA" ? "Prix au m²" : "Prix à la pièce"} (${product.currency})`}
        actions={
          canWrite && (
            <Button type="submit" variant="sun" disabled={busy} data-testid="product-save">
              {busy && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          )
        }
      />
      {errors.length > 0 && (
        <ul role="alert" data-testid="product-errors" className="mb-4 list-disc rounded-xl bg-red-50 p-3 pl-7 text-sm text-red-800">
          {errors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {!canWrite && <p className="mb-4 rounded-xl bg-ip-mist p-3 text-sm">Lecture seule : votre rôle ne permet pas de modifier les produits.</p>}
      <fieldset disabled={!canWrite || busy} className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-bold">Général</h2>
          <Field id="p-name" label="Nom" required>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="product-name" />
          </Field>
          <Field id="p-desc" label="Description">
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field id="p-status" label="Statut">
            <Select id="p-status" value={status} onChange={(e) => setStatus(e.target.value as AdminProduct["status"])} data-testid="product-status">
              <option value="ACTIVE">Actif (visible en boutique)</option>
              <option value="DRAFT">Brouillon</option>
              <option value="ARCHIVED">Archivé</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="p-base" label={`Prix de base (${product.currency})`} required>
              <Input id="p-base" inputMode="decimal" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} data-testid="product-base" />
            </Field>
            <Field id="p-min" label="Quantité minimale" required>
              <Input id="p-min" inputMode="numeric" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-bold">Paliers de prix</h2>
          <p className="text-xs text-ip-muted">Prix unitaire selon la quantité. Les quantités doivent croître strictement.</p>
          <ul className="space-y-2" data-testid="tiers">
            {tiers.map((t, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2" data-testid="tier-row">
                <Field id={`t-q-${i}`} label="À partir de (qté)">
                  <Input id={`t-q-${i}`} inputMode="numeric" value={t.minQty} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)))} data-testid="tier-qty" />
                </Field>
                <Field id={`t-p-${i}`} label={`Prix unit. (${product.currency})`}>
                  <Input id={`t-p-${i}`} inputMode="decimal" value={t.unitPrice} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} data-testid="tier-price" />
                </Field>
                <Button type="button" variant="ghost" size="icon" aria-label={`Retirer le palier ${i + 1}`} disabled={tiers.length <= 1} onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => setTiers([...tiers, { minQty: String((Number(tiers.at(-1)?.minQty) || 0) + 50), unitPrice: tiers.at(-1)?.unitPrice ?? "" }])} data-testid="tier-add">
            <Plus /> Ajouter un palier
          </Button>
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <h2 className="font-heading text-lg font-bold">Options</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="p-colors" label={`${product.colorLabel || "Couleurs"} (séparées par des virgules)`}>
              <Input id="p-colors" value={colors} onChange={(e) => setColors(e.target.value)} />
            </Field>
            <Field id="p-sizes" label={`${product.sizeLabel || "Tailles"} (séparées par des virgules)`}>
              <Input id="p-sizes" value={sizes} onChange={(e) => setSizes(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={colorsRequired} onChange={(e) => setColorsRequired(e.target.checked)} className="size-4 accent-ip-teal" /> Couleur obligatoire
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={sizesRequired} onChange={(e) => setSizesRequired(e.target.checked)} className="size-4 accent-ip-teal" /> Taille obligatoire
            </label>
          </div>
          <p className="text-xs text-ip-muted">Les photos du produit sont gérées dans la configuration du site (limitation actuelle).</p>
        </Card>
      </fieldset>
    </form>
  );
}
