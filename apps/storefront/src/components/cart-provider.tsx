"use client";

import * as React from "react";
import { toast } from "sonner";
import { getProduct, type Product } from "@/lib/catalog";

export interface CartLine {
  slug: string;
  quantity: number;
}

export interface ResolvedCartLine extends CartLine {
  product: Product;
  lineTotal: number;
}

interface CartContextValue {
  lines: ResolvedCartLine[];
  count: number;
  total: number;
  ready: boolean;
  add: (slug: string, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "impactpro.cart.v1";
const CartContext = React.createContext<CartContextValue | null>(null);

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === "object" && l !== null && typeof l.slug === "string" && Number.isInteger(l.quantity) && l.quantity > 0,
    );
  } catch {
    return [];
  }
}

function writeStorage(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage unavailable (private mode, blocked): cart still works for this page session.
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [raw, setRaw] = React.useState<CartLine[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setRaw(readStorage());
    setReady(true);
  }, []);

  const update = React.useCallback((fn: (prev: CartLine[]) => CartLine[]) => {
    setRaw((prev) => {
      const next = fn(prev);
      writeStorage(next);
      return next;
    });
  }, []);

  const add = React.useCallback(
    (slug: string, quantity?: number) => {
      const product = getProduct(slug);
      if (!product) {
        toast.error("Produit introuvable.");
        return;
      }
      const qty = Math.max(1, Math.floor(quantity ?? product.minQuantity));
      update((prev) => {
        const existing = prev.find((l) => l.slug === slug);
        return existing
          ? prev.map((l) => (l.slug === slug ? { ...l, quantity: l.quantity + qty } : l))
          : [...prev, { slug, quantity: qty }];
      });
      toast.success(`${product.name} ajouté au panier`, { description: `Quantité : ${qty}` });
    },
    [update],
  );

  const setQuantity = React.useCallback(
    (slug: string, quantity: number) => {
      const q = Math.floor(quantity);
      if (!Number.isFinite(q) || q < 1) return;
      update((prev) => prev.map((l) => (l.slug === slug ? { ...l, quantity: Math.min(q, 1_000_000) } : l)));
    },
    [update],
  );

  const remove = React.useCallback((slug: string) => update((prev) => prev.filter((l) => l.slug !== slug)), [update]);
  const clear = React.useCallback(() => update(() => []), [update]);

  const value = React.useMemo<CartContextValue>(() => {
    const lines = raw.flatMap((l) => {
      const product = getProduct(l.slug);
      return product ? [{ ...l, product, lineTotal: product.priceHTG * l.quantity }] : [];
    });
    return {
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      total: lines.reduce((n, l) => n + l.lineTotal, 0),
      ready,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [raw, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
