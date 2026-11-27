import { Injectable } from '@nestjs/common';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const D = Prisma.Decimal;
const todayUtc = (): Date => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
const parseDate = (s: string): Date => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

export interface RevenueRow {
  period: string;
  currency: string;
  invoiced: string;
  paid: string;
}

export interface AgingRow {
  currency: string;
  current: string;
  d1_30: string;
  d31_60: string;
  d61_plus: string;
  total: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Invoiced (issue date of sent/paid invoices) and paid (non-voided payments by payment date), per period and currency. */
  async revenue(from: string | undefined, to: string | undefined, groupBy: 'day' | 'month'): Promise<RevenueRow[]> {
    const end = to ? parseDate(to) : todayUtc();
    const start = from ? parseDate(from) : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
    const unit = groupBy === 'day' ? Prisma.sql`'day'` : Prisma.sql`'month'`;
    const fmt = groupBy === 'day' ? Prisma.sql`'YYYY-MM-DD'` : Prisma.sql`'YYYY-MM'`;
    const endExclusive = new Date(end.getTime() + 86_400_000);

    const invoiced = await this.prisma.$queryRaw<{ period: string; currency: string; amount: Prisma.Decimal }[]>(Prisma.sql`
      SELECT to_char(date_trunc(${unit}, "issueDate"), ${fmt}) AS period, "currency" AS currency, SUM("total") AS amount
      FROM "Document"
      WHERE "type" = 'INVOICE' AND "status" IN ('SENT', 'PARTIALLY_PAID', 'PAID') AND "issueDate" >= ${start} AND "issueDate" < ${endExclusive}
      GROUP BY 1, 2`);
    const paid = await this.prisma.$queryRaw<{ period: string; currency: string; amount: Prisma.Decimal }[]>(Prisma.sql`
      SELECT to_char(date_trunc(${unit}, "paidAt"), ${fmt}) AS period, "currency" AS currency, SUM("amount") AS amount
      FROM "Payment"
      WHERE "voidedAt" IS NULL AND "paidAt" >= ${start} AND "paidAt" < ${endExclusive}
      GROUP BY 1, 2`);

    const map = new Map<string, RevenueRow>();
    const row = (period: string, currency: string): RevenueRow => {
      const k = `${period}|${currency}`;
      let r = map.get(k);
      if (!r) map.set(k, (r = { period, currency, invoiced: '0.00', paid: '0.00' }));
      return r;
    };
    for (const r of invoiced) row(r.period, r.currency).invoiced = new D(r.amount).toFixed(2);
    for (const r of paid) row(r.period, r.currency).paid = new D(r.amount).toFixed(2);
    return [...map.values()].sort((a, b) => (a.period === b.period ? a.currency.localeCompare(b.currency) : a.period.localeCompare(b.period)));
  }

  /** Open invoices by days past due (due date, or issue date when none): current, 1–30, 31–60, 61+. */
  async aging(): Promise<AgingRow[]> {
    const open = await this.prisma.document.findMany({
      where: { type: DocumentType.INVOICE, status: { in: [DocumentStatus.SENT, DocumentStatus.PARTIALLY_PAID] }, balance: { gt: 0 } },
      select: { currency: true, balance: true, dueDate: true, issueDate: true },
    });
    const today = todayUtc().getTime();
    const out = new Map<string, { current: Prisma.Decimal; d1_30: Prisma.Decimal; d31_60: Prisma.Decimal; d61_plus: Prisma.Decimal }>();
    for (const d of open) {
      const b = out.get(d.currency) ?? { current: new D(0), d1_30: new D(0), d31_60: new D(0), d61_plus: new D(0) };
      const overdueDays = Math.floor((today - (d.dueDate ?? d.issueDate).getTime()) / 86_400_000);
      const key = overdueDays <= 0 ? 'current' : overdueDays <= 30 ? 'd1_30' : overdueDays <= 60 ? 'd31_60' : 'd61_plus';
      b[key] = b[key].plus(d.balance);
      out.set(d.currency, b);
    }
    return [...out.entries()].map(([currency, b]) => ({
      currency,
      current: b.current.toFixed(2),
      d1_30: b.d1_30.toFixed(2),
      d31_60: b.d31_60.toFixed(2),
      d61_plus: b.d61_plus.toFixed(2),
      total: b.current.plus(b.d1_30).plus(b.d31_60).plus(b.d61_plus).toFixed(2),
    }));
  }
}
