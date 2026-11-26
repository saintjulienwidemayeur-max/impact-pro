"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Placement, PriceTier, UploadedLogo } from "@/lib/api";
import { unitPriceFor } from "@/lib/pricing";

/** Live-preview adjustments chosen in the customizer. */
export interface PreviewParams {
  /** Logo scale relative to the print area (0.4 – 1.4). */
  scale: number;
  /** Offset from the print-area center, as a fraction of the area size (-0.5 – 0.5). */
  dx: number;
  dy: number;
}

/**
 * A customized cart line. Product facts (name, prices) are a snapshot used for estimates only —
 * the API recomputes every price when the order is placed.
 */
export interface CartLine {
  id: string;
  productSlug: string;
  productName: string;
  unitLabel: string;
  minQty: number;
  basePrice: string;
  priceTiers: PriceTier[];
  quantity: number;
  color?: string;
  size?: string;
  placement: Placement;
  logo: Pick<UploadedLogo, "id" | "url" | "mimeType" | "originalName">;
  preview: PreviewParams;
  notes?: string;
}

export interface ResolvedCartLine extends CartLine {
  unitPrice: number;
  lineTotal: number;
}

interface CartContextValue {
  lines: ResolvedCartLine[];
  /** Number of customized items (lines) in the cart. */
  count: number;
  total: number;
  ready: boolean;
  add: (line: Omit<CartLine, "id">) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "impactpro.cart.v2";
const CartContext = React.createContext<CartContextValue | null>(null);

function isLine(l: unknown): l is CartLine {
  if (typeof l !== "object" || l === null) return false;
  const r = l as Record<string, unknown>;
  const logo = r.logo as Record<string, unknown> | undefined;
  return (
    typeof r.id === "string" &&
    typeof r.productSlug === "string" &&
    typeof r.productName === "string" &&
    Number.isInteger(r.quantity) &&
    (r.quantity as number) > 0 &&
    typeof r.placement === "string" &&
    typeof r.basePrice === "string" &&
    Array.isArray(r.priceTiers) &&
    !!logo &&
    typeof logo.id === "string" &&
    typeof logo.url === "string"
  );
}

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLine) : [];
  } catch {
    return [];
  }
}

function writeStorage(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage unavailable (private mode, blocked): the cart still works for this page session.
  }
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [raw, setRaw] = React.useState<CartLine[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setRaw(readStorage());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRaw(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = React.useCallback((fn: (prev: CartLine[]) => CartLine[]) => {
    setRaw((prev) => {
      const next = fn(prev);
      writeStorage(next);
      return next;
    });
  }, []);

  const add = React.useCallback(
    (line: Omit<CartLine, "id">) => {
      const qty = Math.max(line.minQty, Math.floor(line.quantity));
      update((prev) => [...prev, { ...line, quantity: qty, id: newId() }]);
      toast.success(`${line.productName} ajouté au panier`, { description: `Quantité : ${qty} · logo « ${line.logo.originalName} »` });
    },
    [update],
  );

  const setQuantity = React.useCallback(
    (id: string, quantity: number) => {
      const q = Math.floor(quantity);
      if (!Number.isFinite(q) || q < 1) return;
      update((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: Math.min(Math.max(q, l.minQty), 100_000) } : l)));
    },
    [update],
  );

  const remove = React.useCallback((id: string) => update((prev) => prev.filter((l) => l.id !== id)), [update]);
  const clear = React.useCallback(() => update(() => []), [update]);

  const value = React.useMemo<CartContextValue>(() => {
    const lines = raw.map((l) => {
      const unitPrice = unitPriceFor(l.quantity, l.basePrice, l.priceTiers);
      return { ...l, unitPrice, lineTotal: unitPrice * l.quantity };
    });
    return {
      lines,
      count: lines.length,
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
