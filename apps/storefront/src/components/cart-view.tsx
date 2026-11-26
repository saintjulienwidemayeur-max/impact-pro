"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { ProductVisual } from "./product-visual";
import { Button } from "./ui/button";
import { formatHTG } from "@/lib/utils";

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
        <p className="mt-1 max-w-md text-sm text-ip-muted">Parcourez nos articles et ajoutez ceux que vous souhaitez personnaliser.</p>
        <Link href="/produits" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600">
          Voir les produits <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul className="divide-y divide-ip-line rounded-2xl border border-ip-line" aria-label="Articles du panier">
        {lines.map((l) => (
          <li key={l.slug} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="h-24 w-28 shrink-0 rounded-xl bg-ip-mist p-1">
              <ProductVisual product={l.product} />
            </div>
            <div className="flex-1">
              <Link href={`/produits/${l.slug}`} className="font-semibold hover:text-ip-teal">
                {l.product.name}
              </Link>
              <p className="text-xs text-ip-muted">
                {formatHTG(l.product.priceHTG)} / {l.product.unit} · min. {l.product.minQuantity}
              </p>
              {l.quantity < l.product.minQuantity && (
                <p className="mt-1 text-xs text-red-700">Quantité minimale de commande : {l.product.minQuantity}.</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor={`qty-${l.slug}`} className="sr-only">
                Quantité pour {l.product.name}
              </label>
              <input
                id={`qty-${l.slug}`}
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={l.quantity}
                key={l.quantity}
                onBlur={(e) => setQuantity(l.slug, Number.parseInt(e.target.value, 10))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setQuantity(l.slug, Number.parseInt(e.currentTarget.value, 10));
                }}
                className="h-10 w-24 rounded-xl border border-ip-line text-center font-semibold focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50"
              />
              <span className="w-28 text-right font-bold">{formatHTG(l.lineTotal)}</span>
              <button
                type="button"
                onClick={() => remove(l.slug)}
                aria-label={`Retirer ${l.product.name} du panier`}
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
            <dt>Sous-total estimé</dt>
            <dd className="font-semibold">{formatHTG(total)}</dd>
          </div>
          <div className="flex justify-between text-ip-muted">
            <dt>Personnalisation & livraison</dt>
            <dd>Sur devis</dd>
          </div>
        </dl>
        <Link
          href="/devis?depuis=panier"
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ip-sun font-bold text-ip-ink hover:bg-ip-sun-600"
        >
          Demander un devis pour ce panier <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-xs text-ip-muted">Le paiement en ligne arrive bientôt. Un conseiller confirme votre devis sous 24 h ouvrées.</p>
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
