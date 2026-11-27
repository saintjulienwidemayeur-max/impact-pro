import { Inject, Injectable } from '@nestjs/common';
import { CustomOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { auditInclude, toAuditEntry, type AuditEntry } from '../audit/admin-audit.controller';
import { AdminOrdersService, type OrderListItem } from '../orders/admin-orders.service';
import { BILLING_STATS, type BillingDashboardStats, type BillingStatsProvider } from '../ports/billing-stats.port';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardView {
  generatedAt: string;
  orders: { total: number; byStatus: Record<CustomOrderStatus, number>; last7d: number; last30d: number };
  revenue: BillingDashboardStats['revenue'];
  customers: { total: number; new30d: number };
  documents: BillingDashboardStats['documents'];
  /** Unread e-mails; null until the mail module is configured (stage 2). */
  mail: { unread: number } | null;
  recentOrders: OrderListItem[];
  topProducts: { productName: string; quantity: number; orders: number }[];
  activity: AuditEntry[];
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: AdminOrdersService,
    @Inject(BILLING_STATS) private readonly billing: BillingStatsProvider,
  ) {}

  async get(): Promise<DashboardView> {
    const now = Date.now();
    const d7 = new Date(now - 7 * DAY_MS);
    const d30 = new Date(now - 30 * DAY_MS);
    const [byStatusRows, last7d, last30d, customersTotal, customersNew, recent, top, activity, billing] = await Promise.all([
      this.prisma.customOrder.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.customOrder.count({ where: { createdAt: { gte: d7 } } }),
      this.prisma.customOrder.count({ where: { createdAt: { gte: d30 } } }),
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { createdAt: { gte: d30 } } }),
      this.prisma.customOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, reference: true, status: true, currency: true, subtotal: true, customerName: true, company: true, email: true, phone: true,
          createdAt: true, customerId: true, _count: { select: { items: true } },
        },
      }),
      this.prisma.$queryRaw<{ productName: string; quantity: bigint; orders: bigint }[]>`
        SELECT i."productName" AS "productName", SUM(i."quantity") AS quantity, COUNT(DISTINCT i."orderId") AS orders
        FROM "CustomOrderItem" i
        JOIN "CustomOrder" o ON o."id" = i."orderId"
        WHERE o."createdAt" >= ${d30} AND o."status" <> 'CANCELLED'
        GROUP BY i."productName"
        ORDER BY SUM(i."quantity") DESC, i."productName" ASC
        LIMIT 5`,
      this.prisma.auditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10, include: auditInclude }),
      this.billing.dashboard(),
    ]);

    const byStatus = Object.fromEntries(Object.values(CustomOrderStatus).map((s) => [s, 0])) as Record<CustomOrderStatus, number>;
    let total = 0;
    for (const r of byStatusRows) {
      byStatus[r.status] = r._count._all;
      total += r._count._all;
    }
    return {
      generatedAt: new Date(now).toISOString(),
      orders: { total, byStatus, last7d, last30d },
      revenue: billing.revenue,
      customers: { total: customersTotal, new30d: customersNew },
      documents: billing.documents,
      mail: null,
      recentOrders: await this.orders.listItemsFor(recent),
      topProducts: top.map((t) => ({ productName: t.productName, quantity: Number(t.quantity), orders: Number(t.orders) })),
      activity: activity.map(toAuditEntry),
    };
  }
}
