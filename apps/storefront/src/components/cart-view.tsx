"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { useCart, type ResolvedCartLine } from "./cart-provider";
import { LogoPreview } from "./logo-preview";
import { Button } from "./ui/button";
import { previewFor } from "@/config/product-media";
import { placementLabels } from "@/lib/api";
import { formatHTG } from "@/lib/utils";

export function CartLineSummary({ line }: { line: ResolvedCartLine }) {
  const target = previewFor(line.productSlug, line.placement, line.color);
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 shrink-0 overflow-hidden rounded-xl border border-ip-line bg-white sm:w-28">
        {target ? (
          <LogoPreview photo={target.photo} area={target.area} logo={line.logo} params={line.preview} sizes="112px" compact />
        ) : (
          <div className="aspect-square bg-ip-mist" />
        )}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{line.productName}</p>
        <p className="text-xs text-ip-muted">
          {[placementLabels[line.placement], line.color, line.size].filter(Boolean).join(" · ")}
        </p>
        <p className="truncate text-xs text-ip-muted">Logo : {line.logo.originalName}</p>
        {line.notes && <p className="mt-0.5 line-clamp-2 text-xs italic text-ip-muted">« {line.notes} »</p>}
      </div>
    </div>
  );
}

export function CartView() {
  const { lines, total, ready, setQuantity, remove, clear } = useCart();
  const [confirmClear, setConfirmClear] = React.useState(false);

  if (!ready) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Chargement du panier">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-ip-mist" />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ip-line bg-ip-mist px-6 py-16 text-center">
        <ShoppingCart className="size-12 text-ip-teal" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold">Votre panier est vide</h2>
        <p className="mt-1 max-w-md text-sm text-ip-muted">Choisissez un article, ajoutez votre logo et il apparaîtra ici.</p>
        <Link href="/personnaliser" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600">
          Personnaliser un article <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul className="divide-y divide-ip-line rounded-2xl border border-ip-line" aria-label="Articles du panier">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center" data-testid="cart-line">
            <div className="flex-1">
              <CartLineSummary line={l} />
              <Link href={`/personnaliser/${l.productSlug}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ip-teal hover:underline">
                <Pencil className="size-3" aria-hidden="true" /> Personnaliser à nouveau
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label htmlFor={`qty-${l.id}`} className="sr-only">
                  Quantité pour {l.productName}
                </label>
                <input
                  id={`qty-${l.id}`}
                  type="number"
                  min={l.minQty}
                  inputMode="numeric"
                  defaultValue={l.quantity}
                  key={l.quantity}
                  onBlur={(e) => setQuantity(l.id, Number.parseInt(e.target.value, 10))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setQuantity(l.id, Number.parseInt(e.currentTarget.value, 10));
                  }}
                  aria-describedby={`qty-${l.id}-hint`}
                  className="h-10 w-24 rounded-xl border border-ip-line text-center font-semibold focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50"
                />
                <p id={`qty-${l.id}-hint`} className="mt-0.5 text-center text-[10px] text-ip-muted">
                  min. {l.minQty}
                </p>
              </div>
              <div className="w-32 text-right">
                <p className="font-bold">{formatHTG(l.lineTotal)}</p>
                <p className="text-[11px] text-ip-muted">
                  {formatHTG(l.unitPrice)} / {l.unitLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(l.id)}
                aria-label={`Retirer ${l.productName} du panier`}
                className="inline-flex size-10 items-center justify-center rounded-xl text-ip-muted hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <aside className="h-fit rounded-2xl border border-ip-line bg-ip-mist p-6">
        <h2 className="text-lg font-semibold">Récapitulatif</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Sous-total (estimation)</dt>
            <dd className="font-semibold" data-testid="cart-total">
              {formatHTG(total)}
            </dd>
          </div>
          <div className="flex justify-between text-ip-muted">
            <dt>Livraison</dt>
            <dd>Calculée ensuite</dd>
          </div>
        </dl>
        <Link
          href="/commande"
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ip-sun font-bold text-ip-ink hover:bg-ip-sun-600"
        >
          Passer la commande <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-xs text-ip-muted">Prix estimés : le montant final est calculé par notre système à la validation, puis confirmé avec votre maquette.</p>
        <div className="mt-4 border-t border-ip-line pt-4">
          {confirmClear ? (
            <div role="alertdialog" aria-label="Confirmer" className="flex flex-col gap-2 text-sm">
              <p>Vider tout le panier ?</p>
              <div className="flex gap-2">
                <Button
                  variant="ink"
                  size="sm"
                  onClick={() => {
                    clear();
                    setConfirmClear(false);
                  }}
                >
                  Oui, vider
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="text-sm text-ip-muted underline hover:text-red-700">
              Vider le panier
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
