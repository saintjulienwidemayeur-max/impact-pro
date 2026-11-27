import { Injectable } from '@nestjs/common';
import { DocumentStatus, DocumentType, type Document } from '@prisma/client';
import type {
  BillingDashboardStats,
  BillingStatsProvider,
  CurrencyBalance,
  DocumentSummary,
} from '../admin/ports/billing-stats.port';
import { PrismaService } from '../prisma/prisma.service';
import { BillingStatsService } from './billing-stats.service';

const OPEN: DocumentStatus[] = [DocumentStatus.SENT, DocumentStatus.PARTIALLY_PAID];

/** Real implementation of the admin core's `BILLING_STATS` port, backed by the billing tables. */
@Injectable()
export class BillingStatsProviderImpl implements BillingStatsProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: BillingStatsService,
  ) {}

  async dashboard(): Promise<BillingDashboardStats> {
    const [revenue, documents] = await Promise.all([this.stats.revenueByCurrency(), this.stats.documentCounts()]);
    return { revenue, documents };
  }

  balancesByCustomer(customerIds: string[]): Promise<Record<string, CurrencyBalance[]>> {
    return this.stats.balancesByCustomer(customerIds);
  }

  async documentsForCustomer(customerId: string): Promise<DocumentSummary[]> {
    const docs = await this.prisma.document.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return docs.map(toSummary);
  }

  async documentsForOrder(orderId: string): Promise<DocumentSummary[]> {
    const docs = await this.prisma.document.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    return docs.map(toSummary);
  }

  async orderIdsWithDocuments(orderIds: string[]): Promise<Set<string>> {
    if (!orderIds.length) return new Set();
    const rows = await this.prisma.document.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true }, distinct: ['orderId'] });
    return new Set(rows.map((r) => r.orderId).filter((id): id is string => Boolean(id)));
  }
}

function toSummary(d: Document): DocumentSummary {
  const today = new Date().toISOString().slice(0, 10);
  const due = d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null;
  return {
    id: d.id,
    type: d.type,
    number: d.number,
    status: d.status,
    isOverdue: d.type === DocumentType.INVOICE && OPEN.includes(d.status) && d.balance.gt(0) && due !== null && due < today,
    currency: d.currency,
    total: d.total.toFixed(2),
    balance: d.balance.toFixed(2),
    issueDate: d.issueDate.toISOString().slice(0, 10),
    customerName: d.customerName,
  };
}
