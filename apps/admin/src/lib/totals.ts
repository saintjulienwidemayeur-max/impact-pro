/**
 * Billing totals — the SAME formula as the API (docs/admin-contract.md §3). The server is the source of truth; this
 * is used for the live preview in the editor and is tested against shared vectors.
 *
 *   lineTotal  = round2(quantity × unitPrice × (1 − discountPercent/100))   (round half away from zero)
 *   subtotal   = Σ lineTotal
 *   base       = max(0, subtotal − discountAmount)
 *   taxTotal   = round2(base × taxRate/100)
 *   total      = base + shippingAmount + taxTotal
 *   amountPaid = Σ non-voided payments ;  balance = total − amountPaid
 *
 * Plain relative imports only: this file is also loaded by the Playwright unit spec.
 */
export interface TotalsLine {
  quantity: number | string;
  unitPrice: number | string;
  discountPercent?: number | string;
}
export interface TotalsInput {
  lines: TotalsLine[];
  discountAmount?: number | string;
  shippingAmount?: number | string;
  taxRate?: number | string;
  payments?: (number | string)[];
}
export interface Totals {
  lineTotals: string[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balance: string;
}

const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Rounds to cents, half away from zero, tolerant to binary floating point noise. */
export function round2(x: number): number {
  const s = x < 0 ? -1 : 1;
  return (s * Math.floor(Math.abs(x) * 100 + 0.5 + 1e-9)) / 100;
}

export function computeTotals(input: TotalsInput): Totals {
  const lineCents = input.lines.map((l) => Math.round(round2(num(l.quantity) * num(l.unitPrice) * (1 - num(l.discountPercent) / 100)) * 100));
  const subtotalC = lineCents.reduce((a, b) => a + b, 0);
  const discountC = Math.round(round2(num(input.discountAmount)) * 100);
  const baseC = Math.max(0, subtotalC - discountC);
  const taxC = Math.round(round2((baseC / 100) * (num(input.taxRate) / 100)) * 100);
  const shipC = Math.round(round2(num(input.shippingAmount)) * 100);
  const totalC = baseC + shipC + taxC;
  const paidC = (input.payments ?? []).reduce<number>((a, p) => a + Math.round(round2(num(p)) * 100), 0);
  const f = (c: number) => (c / 100).toFixed(2);
  return {
    lineTotals: lineCents.map(f),
    subtotal: f(subtotalC),
    discountTotal: f(Math.min(discountC, subtotalC)),
    taxTotal: f(taxC),
    total: f(totalC),
    amountPaid: f(paidC),
    balance: f(totalC - paidC),
  };
}
