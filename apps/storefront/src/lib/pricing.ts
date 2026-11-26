import type { PriceTier } from "./api";

export function toNumber(money: string | number | null | undefined): number {
  if (money === null || money === undefined) return 0;
  const n = typeof money === "number" ? money : Number.parseFloat(money);
  return Number.isFinite(n) ? n : 0;
}

/** Unit price for a quantity: the highest tier whose minQty ≤ qty, otherwise the base price. */
export function unitPriceFor(qty: number, basePrice: string, tiers: PriceTier[]): number {
  let price = toNumber(basePrice);
  let best = -1;
  for (const t of tiers) {
    if (t.minQty <= qty && t.minQty > best) {
      best = t.minQty;
      price = toNumber(t.unitPrice);
    }
  }
  return price;
}

export function sortedTiers(tiers: PriceTier[]): PriceTier[] {
  return [...tiers].sort((a, b) => a.minQty - b.minQty);
}

/** "À partir de" price: the cheapest tier or the base price. */
export function lowestPrice(basePrice: string, tiers: PriceTier[]): number {
  return Math.min(toNumber(basePrice), ...tiers.map((t) => toNumber(t.unitPrice)));
}
