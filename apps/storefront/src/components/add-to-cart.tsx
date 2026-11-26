"use client";

import * as React from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "./ui/button";
import { useCart } from "./cart-provider";
import type { Product } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Compact icon button used on product cards. Adds the product's minimum quantity. */
export function AddToCartIconButton({ product, className }: { product: Product; className?: string }) {
  const { add } = useCart();
  return (
    <button
      type="button"
      onClick={() => add(product.slug)}
      aria-label={`Ajouter ${product.name} au panier (${product.minQuantity} ${product.unit})`}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ip-sun text-ip-ink transition-colors hover:bg-ip-sun",
        className,
      )}
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
    </button>
  );
}

/** Quantity selector + add button for product detail pages. */
export function AddToCartForm({ product }: { product: Product }) {
  const { add } = useCart();
  const [qty, setQty] = React.useState(product.minQuantity);
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(qty) || qty < product.minQuantity) {
      setError(`Quantité minimale : ${product.minQuantity}.`);
      return;
    }
    setError(null);
    add(product.slug, qty);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="qty" className="text-sm font-medium">
        Quantité ({product.unit}) — minimum {product.minQuantity}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-xl border border-ip-line">
          <button
            type="button"
            aria-label="Diminuer la quantité"
            onClick={() => setQty((q) => Math.max(product.minQuantity, q - 1))}
            className="inline-flex size-11 items-center justify-center rounded-l-xl hover:bg-ip-mist"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <input
            id="qty"
            type="number"
            inputMode="numeric"
            min={product.minQuantity}
            value={Number.isFinite(qty) ? qty : ""}
            onChange={(e) => setQty(Number.parseInt(e.target.value, 10))}
            aria-invalid={Boolean(error)}
            aria-describedby="qty-msg"
            className="h-11 w-20 border-x border-ip-line text-center font-semibold focus:outline-none"
          />
          <button
            type="button"
            aria-label="Augmenter la quantité"
            onClick={() => setQty((q) => (Number.isFinite(q) ? q + 1 : product.minQuantity))}
            className="inline-flex size-11 items-center justify-center rounded-r-xl hover:bg-ip-mist"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <Button type="submit" variant="sun" size="lg">
          <ShoppingCart aria-hidden="true" /> Ajouter au panier
        </Button>
      </div>
      <p id="qty-msg" className="min-h-4 text-xs text-red-700" role={error ? "alert" : undefined}>
        {error ?? ""}
      </p>
    </form>
  );
}
