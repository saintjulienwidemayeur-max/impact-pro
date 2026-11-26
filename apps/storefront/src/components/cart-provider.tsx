"use client";

import * as React from "react";
import { toast } from "sonner";
import type { PriceTier } from "@/lib/api";
import { estimateUnit, newId, summarizeZones, describeZone, type CustomSize, type DesignElement } from "@/lib/design";

/**
 * A customized cart line (design = flat list of elements, docs/customizer-v2-contract.md §5).
 * Product facts (name, prices) are a snapshot used for estimates only — the API recomputes every price at order time.
 */
export interface CartLine {
  id: string;
  productSlug: string;
  productName: string;
  unitLabel: string;
  minQty: number;
  basePrice: string;
  priceTiers: PriceTier[];
  pricingMode: "PER_PIECE" | "PER_AREA";
  customSize: CustomSize | null;
  quantity: number;
  color?: string;
  size?: string;
  widthCm?: number;
  heightCm?: number;
  elements: DesignElement[];
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

const STORAGE_KEY = "impactpro.cart.v3";
const CartContext = React.createContext<CartContextValue | null>(null);

function isElement(e: unknown): e is DesignElement {
  if (typeof e !== "object" || e === null) return false;
  const r = e as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.placement === "string" && (r.kind === "LOGO" || r.kind === "TEXT" || r.kind === "ARTWORK") && typeof r.x === "number" && typeof r.y === "number" && typeof r.scale === "number";
}

function isLine(l: unknown): l is CartLine {
  if (typeof l !== "object" || l === null) return false;
  const r = l as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.productSlug === "string" &&
    typeof r.productName === "string" &&
    Number.isInteger(r.quantity) &&
    (r.quantity as number) > 0 &&
    typeof r.basePrice === "string" &&
    Array.isArray(r.priceTiers) &&
    Array.isArray(r.elements) &&
    (r.elements as unknown[]).length > 0 &&
    (r.elements as unknown[]).every(isElement)
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [raw, setRaw] = React.useState<CartLine[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      window.localStorage.removeItem("impactpro.cart.v2"); // v2 (single logo) carts are dropped
    } catch {
      // ignore
    }
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
      const zones = summarizeZones(line.elements).map(describeZone).filter(Boolean).join(" · ");
      toast.success(`${line.productName} ajouté au panier`, { description: `Quantité : ${qty}${zones ? ` · ${zones}` : ""}` });
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
      const unitPrice = estimateUnit({
        quantity: l.quantity,
        basePrice: l.basePrice,
        priceTiers: l.priceTiers,
        pricingMode: l.pricingMode,
        customSize: l.customSize,
        widthCm: l.widthCm,
        heightCm: l.heightCm,
      });
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
