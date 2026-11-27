import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { pageMeta, parseSort, skipTake } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminActor } from '../admin-context';
import { AdminOrdersService, type OrderListItem } from '../orders/admin-orders.service';
import { BILLING_STATS, type BillingStatsProvider, type CurrencyBalance, type DocumentSummary } from '../ports/billing-stats.port';
import type { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './admin-customers.dto';

export interface CustomerListItem {
  id: string;
  email: string;
  fullName: string;
  company: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  taxId: string | null;
  notes: string | null;
  userId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  ordersCount: number;
  lastOrderAt: string | null;
  balances: CurrencyBalance[];
}

export interface CustomerDetail extends CustomerListItem {
  orders: OrderListItem[];
  documents: DocumentSummary[];
}

type CustomerRow = Prisma.CustomerGetPayload<Record<string, never>>;

const notFound = () => new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orders: AdminOrdersService,
    @Inject(BILLING_STATS) private readonly billing: BillingStatsProvider,
  ) {}

  private async toListItems(rows: CustomerRow[]): Promise<CustomerListItem[]> {
    const ids = rows.map((r) => r.id);
    const [agg, balances] = await Promise.all([
      this.prisma.customOrder.groupBy({ by: ['customerId'], where: { customerId: { in: ids } }, _count: { _all: true }, _max: { createdAt: true } }),
      this.billing.balancesByCustomer(ids),
    ]);
    const byId = new Map(agg.map((a) => [a.customerId, a]));
    return rows.map((c) => {
      const a = byId.get(c.id);
      return {
        id: c.id,
        email: c.email,
        fullName: c.fullName,
        company: c.company,
        phone: c.phone,
        address: c.address,
        city: c.city,
        country: c.country,
        taxId: c.taxId,
        notes: c.notes,
        userId: c.userId,
        source: c.source,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        ordersCount: a?._count._all ?? 0,
        lastOrderAt: a?._max.createdAt?.toISOString() ?? null,
        balances: balances[c.id] ?? [],
      };
    });
  }

  async list(q: ListCustomersQuery) {
    const where: Prisma.CustomerWhereInput = q.q
      ? {
          OR: [
            { email: { contains: q.q, mode: 'insensitive' } },
            { fullName: { contains: q.q, mode: 'insensitive' } },
            { company: { contains: q.q, mode: 'insensitive' } },
            { phone: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const orderBy = parseSort<Prisma.CustomerOrderByWithRelationInput>(
      q.sort,
      { createdAt: (d) => ({ createdAt: d }), fullName: (d) => ({ fullName: d }), email: (d) => ({ email: d }), company: (d) => ({ company: d }) },
      { createdAt: 'desc' },
    );
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, orderBy: [orderBy, { id: 'asc' }], ...skipTake(q) }),
    ]);
    return { items: await this.toListItems(rows), meta: pageMeta(q, total) };
  }

  async detail(id: string): Promise<CustomerDetail> {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw notFound();
    const [[item], orderRows, documents] = await Promise.all([
      this.toListItems([c]),
      this.prisma.customOrder.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, reference: true, status: true, currency: true, subtotal: true, customerName: true, company: true, email: true, phone: true,
          createdAt: true, customerId: true, _count: { select: { items: true } },
        },
      }),
      this.billing.documentsForCustomer(id),
    ]);
    return { ...item, orders: await this.orders.listItemsFor(orderRows), documents };
  }

  async create(dto: CreateCustomerDto, actor: AdminActor): Promise<CustomerDetail> {
    try {
      const c = await this.prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            email: dto.email,
            fullName: dto.fullName,
            company: dto.company ?? null,
            phone: dto.phone ?? null,
            address: dto.address ?? null,
            city: dto.city ?? null,
            country: (dto.country ?? 'HT').toUpperCase(),
            taxId: dto.taxId ?? null,
            notes: dto.notes ?? null,
            source: 'ADMIN',
          },
        });
        await this.audit.record(actor, { action: 'customer.create', entityType: 'Customer', entityId: created.id, metadata: { email: created.email } }, tx);
        return created;
      });
      return this.detail(c.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'CONFLICT', message: 'A customer with this e-mail already exists' });
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateCustomerDto, actor: AdminActor): Promise<CustomerDetail> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw notFound();
    const data: Prisma.CustomerUpdateInput = {};
    const changed: string[] = [];
    if (dto.fullName !== undefined && dto.fullName !== null) {
      data.fullName = dto.fullName;
      changed.push('fullName');
    }
    for (const key of ['company', 'phone', 'address', 'city', 'taxId', 'notes'] as const) {
      if (dto[key] !== undefined) {
        data[key] = dto[key] as string | null;
        changed.push(key);
      }
    }
    if (dto.country !== undefined) {
      data.country = dto.country.toUpperCase();
      changed.push('country');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data });
      await this.audit.record(actor, { action: 'customer.update', entityType: 'Customer', entityId: id, metadata: { fields: changed } }, tx);
    });
    return this.detail(id);
  }
}
