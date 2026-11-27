import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;
type Num = string | number | Prisma.Decimal;

/** Rounds to cents, half away from zero (decimal.js ROUND_HALF_UP). */
export const round2 = (v: Num): Prisma.Decimal => new D(v).toDecimalPlaces(2, D.ROUND_HALF_UP);

export interface LineInput {
  quantity: Num;
  unitPrice: Num;
  discountPercent?: Num;
}

export interface TotalsInput {
  lines: LineInput[];
  /** Fixed document-level discount, applied before tax. */
  discountAmount?: Num;
  shippingAmount?: Num;
  /** Percent, e.g. 6.5 */
  taxRate?: Num;
  amountPaid?: Num;
}

export interface Totals {
  lineTotals: Prisma.Decimal[];
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  balance: Prisma.Decimal;
}

/** `lineTotal = round2(quantity × unitPrice × (1 − discountPercent/100))` */
export function lineTotal(l: LineInput): Prisma.Decimal {
  const pct = new D(l.discountPercent ?? 0);
  return round2(new D(l.quantity).mul(l.unitPrice).mul(new D(1).minus(pct.div(100))));
}

/**
 * Server-side source of truth (the admin UI previews with the same formula, see test/fixtures/billing-vectors.json):
 * `subtotal = Σ lineTotal`, `base = max(0, subtotal − discountAmount)`, `taxTotal = round2(base × taxRate/100)`,
 * `total = base + shippingAmount + taxTotal`, `balance = total − amountPaid`.
 */
export function computeTotals(input: TotalsInput): Totals {
  const lineTotals = input.lines.map(lineTotal);
  const subtotal = lineTotals.reduce((a, b) => a.plus(b), new D(0));
  const discount = new D(input.discountAmount ?? 0);
  const base = D.max(new D(0), subtotal.minus(discount));
  const taxTotal = round2(base.mul(new D(input.taxRate ?? 0)).div(100));
  const total = base.plus(input.shippingAmount ?? 0).plus(taxTotal);
  const amountPaid = new D(input.amountPaid ?? 0);
  return { lineTotals, subtotal, discountTotal: discount, taxTotal, total, amountPaid, balance: total.minus(amountPaid) };
}
