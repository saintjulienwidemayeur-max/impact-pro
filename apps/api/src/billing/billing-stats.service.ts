import { Injectable } from '@nestjs/common';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const D = Prisma.Decimal;
const OPEN: DocumentStatus[] = [DocumentStatus.SENT, DocumentStatus.PARTIALLY_PAID];
const todayUtc = (): Date => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

export interface CurrencyRevenue {
  currency: string;
  paid7d: string;
  paid30d: string;
  outstanding: string;
  overdue: string;
}

export interface DocumentCounts {
  draftQuotes: number;
  openQuotes: number;
  unpaidInvoices: number;
  overdueInvoices: number;
}

export interface CustomerBalance {
  currency: string;
  billed: string;
  paid: string;
  due: string;
}

/**
 * Read-only aggregates for the admin dashboard and the customer directory.
 * The admin core module wires these into its `BillingStatsProvider` port (token `BILLING_STATS_PROVIDER`):
 *  - `revenueByCurrency()` → `dashboard.revenue`
 *  - `documentCounts()`    → `dashboard.documents`
 *  - `balancesByCustomer(ids)` → `CustomerListItem.balances` (keyed by Document.customerId)
 */
@Injectable()
export class BillingStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async revenueByCurrency(): Promise<CurrencyRevenue[]> {
    const now = Date.now();
    const d7 = new Date(now - 7 * 86_400_000);
    const d30 = new Date(now - 30 * 86_400_000);
    const payments = await this.prisma.payment.findMany({ where: { voidedAt: null, paidAt: { gte: d30 } }, select: { currency: true, amount: true, paidAt: true } });
    const open = await this.prisma.document.findMany({
      where: { type: DocumentType.INVOICE, status: { in: OPEN }, balance: { gt: 0 } },
      select: { currency: true, balance: true, dueDate: true },
    });
    const today = todayUtc();
    const acc = new Map<string, { paid7d: Prisma.Decimal; paid30d: Prisma.Decimal; outstanding: Prisma.Decimal; overdue: Prisma.Decimal }>();
    const get = (c: string) => {
      let r = acc.get(c);
      if (!r) acc.set(c, (r = { paid7d: new D(0), paid30d: new D(0), outstanding: new D(0), overdue: new D(0) }));
      return r;
    };
    for (const p of payments) {
      const r = get(p.currency);
      r.paid30d = r.paid30d.plus(p.amount);
      if (p.paidAt >= d7) r.paid7d = r.paid7d.plus(p.amount);
    }
    for (const d of open) {
      const r = get(d.currency);
      r.outstanding = r.outstanding.plus(d.balance);
      if (d.dueDate && d.dueDate < today) r.overdue = r.overdue.plus(d.balance);
    }
    return [...acc.entries()].map(([currency, r]) => ({ currency, paid7d: r.paid7d.toFixed(2), paid30d: r.paid30d.toFixed(2), outstanding: r.outstanding.toFixed(2), overdue: r.overdue.toFixed(2) }));
  }

  async documentCounts(): Promise<DocumentCounts> {
    const today = todayUtc();
    const [draftQuotes, openQuotes, unpaidInvoices, overdueInvoices] = await Promise.all([
      this.prisma.document.count({ where: { type: DocumentType.QUOTE, status: DocumentStatus.DRAFT } }),
      this.prisma.document.count({ where: { type: DocumentType.QUOTE, status: DocumentStatus.SENT, OR: [{ validUntil: null }, { validUntil: { gte: today } }] } }),
      this.prisma.document.count({ where: { type: DocumentType.INVOICE, status: { in: OPEN }, balance: { gt: 0 } } }),
      this.prisma.document.count({ where: { type: DocumentType.INVOICE, status: { in: OPEN }, balance: { gt: 0 }, dueDate: { lt: today } } }),
    ]);
    return { draftQuotes, openQuotes, unpaidInvoices, overdueInvoices };
  }

  /** Billed / paid / due per currency for each customer id (invoices that were sent; voided and draft ones are ignored). */
  async balancesByCustomer(customerIds: string[]): Promise<Record<string, CustomerBalance[]>> {
    const out: Record<string, CustomerBalance[]> = {};
    if (!customerIds.length) return out;
    const grouped = await this.prisma.document.groupBy({
      by: ['customerId', 'currency'],
      where: { customerId: { in: customerIds }, type: DocumentType.INVOICE, status: { in: [DocumentStatus.SENT, DocumentStatus.PARTIALLY_PAID, DocumentStatus.PAID] } },
      _sum: { total: true, amountPaid: true, balance: true },
    });
    for (const g of grouped) {
      if (!g.customerId) continue;
      (out[g.customerId] ??= []).push({
        currency: g.currency,
        billed: new D(g._sum.total ?? 0).toFixed(2),
        paid: new D(g._sum.amountPaid ?? 0).toFixed(2),
        due: new D(g._sum.balance ?? 0).toFixed(2),
      });
    }
    return out;
  }
}
