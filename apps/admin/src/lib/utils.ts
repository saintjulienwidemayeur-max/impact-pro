import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const htg = new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 0 });

/** Formats an amount in Haitian gourdes, e.g. "1 250 HTG". */
export function formatHTG(amount: number): string {
  return `${htg.format(amount)} HTG`;
}

export function discountPercent(price: number, oldPrice?: number): number | null {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
