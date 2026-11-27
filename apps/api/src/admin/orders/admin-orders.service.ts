import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomOrderStatus, Prisma, StaffRole } from '@prisma/client';
import { itemToView, orderInclude, type CustomOrderItemView } from '../../custom-orders/custom-orders.service';
import { AuditService } from '../../common/audit.service';
import { money } from '../../common/money';
import { PageQuery, pageMeta, parseSort, skipTake } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { PERSON_SELECT, personOf, type AdminActor } from '../admin-context';
import { BILLING_STATS, type BillingStatsProvider, type DocumentSummary } from '../ports/billing-stats.port';
import type { ListOrdersQuery, OrderNoteDto, OrderStatusDto } from './admin-orders.dto';

export interface OrderListItem {
  id: string;
  reference: string;
  status: CustomOrderStatus;
  currency: string;
  subtotal: string;
  customerName: string;
  company: string | null;
  email: string;
  phone: string;
  itemCount: number;
  createdAt: string;
  customerId: string | null;
  hasDocuments: boolean;
}

export interface OrderEventView {
  id: string;
  type: 'STATUS' | 'NOTE' | 'DOCUMENT' | 'EMAIL';
  message: string;
  data: unknown;
  actor: { id: string; name: string } | null;
  createdAt: string;
}

export interface OrderDetail extends OrderListItem {
  city: string | null;
  address: string | null;
  deliveryMethod: string;
  notes: string | null;
  customer: { id: string; email: string; fullName: string; company: string | null; phone: string | null } | null;
  items: (CustomOrderItemView & { id: string; lineNo: number; productId: string })[];
  documents: DocumentSummary[];
  events: OrderEventView[];
}

export const STATUS_LABELS_FR: Record<CustomOrderStatus, string> = {
  RECEIVED: 'Reçue',
  MOCKUP_SENT: 'Maquette envoyée',
  APPROVED: 'Approuvée',
  IN_PRODUCTION: 'En production',
  READY: 'Prête',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

/** Normal progression of an order. */
const FLOW: CustomOrderStatus[] = ['RECEIVED', 'MOCKUP_SENT', 'APPROVED', 'IN_PRODUCTION', 'READY', 'DELIVERED'];

/**
 * Allowed transitions: forward along the flow, CANCELLED from any non-delivered order, and CANCELLED → RECEIVED
 * (reopen, ADMIN and SUPER_ADMIN only). Anything else is a 409 INVALID_TRANSITION.
 */
export function checkTransition(from: CustomOrderStatus, to: CustomOrderStatus, role: StaffRole): void {
  const invalid = () =>
    new ConflictException({ code: 'INVALID_TRANSITION', message: `Cannot move an order from ${from} to ${to}`, details: { from, to } });
  if (from === to) throw invalid();
  if (to === 'CANCELLED') {
    if (from === 'DELIVERED') throw invalid();
    return;
  }
  if (from === 'CANCELLED') {
    if (to !== 'RECEIVED') throw invalid();
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only an administrator can reopen a cancelled order' });
    }
    return;
  }
  if (FLOW.indexOf(to) <= FLOW.indexOf(from)) throw invalid();
}

const listSelect = {
  id: true,
  reference: true,
  status: true,
  currency: true,
  subtotal: true,
  customerName: true,
  company: true,
  email: true,
  phone: true,
  createdAt: true,
  customerId: true,
  _count: { select: { items: true } },
} satisfies Prisma.CustomOrderSelect;
type ListRow = Prisma.CustomOrderGetPayload<{ select: typeof listSelect }>;

const eventInclude = { actor: { select: PERSON_SELECT } } satisfies Prisma.CustomOrderEventInclude;

export const toEventView = (e: Prisma.CustomOrderEventGetPayload<{ include: typeof eventInclude }>): OrderEventView => ({
  id: e.id,
  type: e.type,
  message: e.message,
  data: e.data ?? null,
  actor: personOf(e.actor),
  createdAt: e.createdAt.toISOString(),
});

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(BILLING_STATS) private readonly billing: BillingStatsProvider,
  ) {}

  private toListItem(o: ListRow, withDocs: Set<string>): OrderListItem {
    return {
      id: o.id,
      reference: o.reference,
      status: o.status,
      currency: o.currency,
      subtotal: money(o.subtotal),
      customerName: o.customerName,
      company: o.company,
      email: o.email,
      phone: o.phone,
      itemCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
      customerId: o.customerId,
      hasDocuments: withDocs.has(o.id),
    };
  }

  /** Order list item for a set of rows (used by the customers endpoints too). */
  async listItemsFor(rows: ListRow[]): Promise<OrderListItem[]> {
    const withDocs = await this.billing.orderIdsWithDocuments(rows.map((r) => r.id));
    return rows.map((r) => this.toListItem(r, withDocs));
  }

  async list(q: ListOrdersQuery) {
    const where: Prisma.CustomOrderWhereInput = {
      ...(q.status && { status: q.status }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: endOfDay(q.to) }) } }),
      ...(q.customerId && { customerId: q.customerId }),
      ...(q.q && {
        OR: [
          { reference: { contains: q.q, mode: 'insensitive' } },
          { customerName: { contains: q.q, mode: 'insensitive' } },
          { company: { contains: q.q, mode: 'insensitive' } },
          { email: { contains: q.q, mode: 'insensitive' } },
          { phone: { contains: q.q, mode: 'insensitive' } },
        ],
      }),
    };
    const orderBy = parseSort<Prisma.CustomOrderOrderByWithRelationInput>(
      q.sort,
      {
        createdAt: (d) => ({ createdAt: d }),
        reference: (d) => ({ reference: d }),
        subtotal: (d) => ({ subtotal: d }),
        status: (d) => ({ status: d }),
        customerName: (d) => ({ customerName: d }),
      },
      { createdAt: 'desc' },
    );
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customOrder.count({ where }),
      this.prisma.customOrder.findMany({ where, orderBy: [orderBy, { id: 'desc' }], select: listSelect, ...skipTake(q) }),
    ]);
    return { items: await this.listItemsFor(rows), meta: pageMeta(q, total) };
  }

  async detail(id: string): Promise<OrderDetail> {
    const order = await this.prisma.customOrder.findUnique({
      where: { id },
      include: {
        ...orderInclude,
        _count: { select: { items: true } },
        customer: { select: { id: true, email: true, fullName: true, company: true, phone: true } },
        events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: eventInclude },
      },
    });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    const documents = await this.billing.documentsForOrder(order.id);
    return {
      id: order.id,
      reference: order.reference,
      status: order.status,
      currency: order.currency,
      subtotal: money(order.subtotal),
      customerName: order.customerName,
      company: order.company,
      email: order.email,
      phone: order.phone,
      itemCount: order._count.items,
      createdAt: order.createdAt.toISOString(),
      customerId: order.customerId,
      hasDocuments: documents.length > 0,
      city: order.city,
      address: order.address,
      deliveryMethod: order.deliveryMethod,
      notes: order.notes,
      customer: order.customer,
      items: order.items.map((i) => ({ ...itemToView(i), id: i.id, lineNo: i.lineNo, productId: i.productId })),
      documents,
      events: order.events.map(toEventView),
    };
  }

  async setStatus(id: string, dto: OrderStatusDto, actor: AdminActor): Promise<OrderDetail> {
    const order = await this.prisma.customOrder.findUnique({ where: { id }, select: { id: true, reference: true, status: true } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    checkTransition(order.status, dto.status, actor.staffRole);
    await this.prisma.$transaction(async (tx) => {
      // Compare-and-set: two staff members racing on the same order cannot both apply a transition.
      const res = await tx.customOrder.updateMany({ where: { id, status: order.status }, data: { status: dto.status } });
      if (res.count === 0) throw new ConflictException({ code: 'CONFLICT', message: 'The order status changed meanwhile, reload and retry' });
      await tx.customOrderEvent.create({
        data: {
          orderId: id,
          type: 'STATUS',
          message: `Statut : ${STATUS_LABELS_FR[order.status]} → ${STATUS_LABELS_FR[dto.status]}`,
          data: { from: order.status, to: dto.status, ...(dto.note && { note: dto.note }) },
          actorId: actor.actorId,
        },
      });
      if (dto.note) {
        await tx.customOrderEvent.create({ data: { orderId: id, type: 'NOTE', message: dto.note, actorId: actor.actorId } });
      }
      await this.audit.record(
        actor,
        { action: 'order.status_change', entityType: 'CustomOrder', entityId: id, metadata: { reference: order.reference, from: order.status, to: dto.status } },
        tx,
      );
    });
    return this.detail(id);
  }

  async addNote(id: string, dto: OrderNoteDto, actor: AdminActor): Promise<OrderEventView> {
    const order = await this.prisma.customOrder.findUnique({ where: { id }, select: { id: true, reference: true } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    const event = await this.prisma.$transaction(async (tx) => {
      const e = await tx.customOrderEvent.create({
        data: { orderId: id, type: 'NOTE', message: dto.message, actorId: actor.actorId },
        include: eventInclude,
      });
      await this.audit.record(actor, { action: 'order.note', entityType: 'CustomOrder', entityId: id, metadata: { reference: order.reference } }, tx);
      return e;
    });
    return toEventView(event);
  }

  async events(id: string): Promise<OrderEventView[]> {
    const exists = await this.prisma.customOrder.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    const rows = await this.prisma.customOrderEvent.findMany({
      where: { orderId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: eventInclude,
    });
    return rows.map(toEventView);
  }
}

/** `to=2026-11-30` should include the whole day. */
function endOfDay(value: string): Date {
  const d = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
}

export type { PageQuery };
