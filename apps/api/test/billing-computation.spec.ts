import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeTotals, lineTotal, round2 } from '../src/billing/computation';
import { formatAmount } from '../src/billing/pdf.service';

interface Case {
  name: string;
  input: { lines: { quantity: string; unitPrice: string; discountPercent?: string }[]; discountAmount?: string; shippingAmount?: string; taxRate?: string; amountPaid?: string };
  expected: { lineTotals: string[]; subtotal: string; taxTotal: string; total: string; balance: string };
}

const vectors = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'billing-vectors.json'), 'utf8')) as { cases: Case[] };

describe('billing computation (shared vectors)', () => {
  it('has at least 25 vectors', () => {
    expect(vectors.cases.length).toBeGreaterThanOrEqual(25);
  });

  it.each(vectors.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const t = computeTotals(c.input);
    expect(t.lineTotals.map((l) => l.toFixed(2))).toEqual(c.expected.lineTotals);
    expect(t.subtotal.toFixed(2)).toBe(c.expected.subtotal);
    expect(t.taxTotal.toFixed(2)).toBe(c.expected.taxTotal);
    expect(t.total.toFixed(2)).toBe(c.expected.total);
    expect(t.balance.toFixed(2)).toBe(c.expected.balance);
  });
});

describe('billing computation (helpers)', () => {
  it('rounds half away from zero', () => {
    expect(round2('1.005').toFixed(2)).toBe('1.01');
    expect(round2('2.675').toFixed(2)).toBe('2.68');
    expect(round2('-1.005').toFixed(2)).toBe('-1.01');
  });

  it('applies the line discount before rounding', () => {
    expect(lineTotal({ quantity: '3', unitPrice: '10.10', discountPercent: '15' }).toFixed(2)).toBe('25.76');
  });

  it('never lets the document discount make the taxable base negative', () => {
    const t = computeTotals({ lines: [{ quantity: '1', unitPrice: '10' }], discountAmount: '50', taxRate: '10', shippingAmount: '5' });
    expect(t.total.toFixed(2)).toBe('5.00');
    expect(t.taxTotal.toFixed(2)).toBe('0.00');
  });

  it('formats amounts with thousands separators and 2 decimals', () => {
    expect(formatAmount('1234567.5')).toMatch(/1.234.567[.,]50/);
  });
});
