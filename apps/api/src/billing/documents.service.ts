import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DocumentStatus, DocumentType, Prisma, type StaffRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { permissionsFor } from '../admin/rbac/staff.guard';
import { Paginated } from '../common/response.interceptor';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { BillingSettingsService } from './billing-settings.service';
import type {
  ActorRef,
  DocumentEventView,
  DocumentLineView,
  DocumentSummary,
  DocumentView,
  PaymentView,
  PublicDocumentView,
} from './billing.types';
import { computeTotals } from './computation';
import type {
  CreateDocumentDto,
  DocumentLineDto,
  DocumentListQuery,
  RecordPaymentDto,
  SendDocumentDto,
  UpdateDocumentDto,
} from './dto/billing.dto';
import { NumberingService } from './numbering.service';
import { PdfService } from './pdf.service';
import { DOCUMENT_MAILER, MailNotConfiguredError, type DocumentMailer } from './ports/document-mailer.port';

const D = Prisma.Decimal;
const TYPE_LABEL: Record<DocumentType, string> = { QUOTE: 'Devis', PROFORMA: 'Facture proforma', INVOICE: 'Facture' };
const ZONE_LABEL: Record<string, string> = {
  FRONT: 'Devant', BACK: 'Dos', CHEST_LEFT: 'Cœur', SLEEVE: 'Manche', WRAP: 'Tour complet', FULL: 'Pleine surface', SIDE: 'Côté', TOP: 'Dessus',
};
const OPEN_INVOICE: DocumentStatus[] = [DocumentStatus.SENT, DocumentStatus.PARTIALLY_PAID];
const QUOTE_EDITABLE_AFTER_SENT = new Set(['notes', 'dueDate', 'validUntil', 'terms', 'internalNotes']);
const INVOICE_EDITABLE_AFTER_SENT = new Set(['internalNotes']);

export interface RequestCtx {
  ipAddress?: string;
  requestId?: string;
}

interface Actor extends ActorRef {
  role: StaffRole;
}

type OrderWithItems = Prisma.CustomOrderGetPayload<{ include: { items: { include: { elements: { select: { placement: true } } } } } }>;
const fullInclude = {
  lines: { orderBy: { position: 'asc' } },
  payments: { orderBy: { paidAt: 'asc' } },
  events: { orderBy: { createdAt: 'asc' } },
  children: { select: { id: true, type: true, number: true } },
  parent: { select: { id: true, number: true } },
} satisfies Prisma.DocumentInclude;
type FullDocument = Prisma.DocumentGetPayload<{ include: typeof fullInclude }>;

const readPermission = (t: DocumentType) => (t === DocumentType.INVOICE ? 'invoices.read' : 'quotes.read');
const writePermission = (t: DocumentType) => (t === DocumentType.INVOICE ? 'invoices.write' : 'quotes.write');

/** `YYYY-MM-DD…` → Date at UTC midnight (the `@db.Date` columns carry no time). */
const parseDate = (s: string): Date => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
const todayUtc = (): Date => parseDate(new Date().toISOString());
const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86_400_000);
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const day = (d: Date): string => d.toISOString().slice(0, 10);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BillingSettingsService,
    private readonly numbering: NumberingService,
    private readonly pdf: PdfService,
    @Inject(ENV) private readonly env: Env,
    @Inject(DOCUMENT_MAILER) private readonly mailer: DocumentMailer,
  ) {}

  // ---------------------------------------------------------------------------------------------------------------
  // Access
  // ---------------------------------------------------------------------------------------------------------------

  async actor(userId: string): Promise<Actor> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, fullName: true, firstName: true, lastName: true, staffRole: true } });
    if (!u?.staffRole) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Staff access required' });
    return { id: u.id, name: displayName(u), role: u.staffRole };
  }

  can(actor: Actor, permission: string): boolean {
    return permissionsFor(actor.role).includes(permission);
  }

  private require(actor: Actor, permission: string): void {
    if (!this.can(actor, permission)) throw new ForbiddenException({ code: 'FORBIDDEN', message: `Missing permission ${permission}` });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------------------------------------------

  /** Quotes past their `validUntil` become EXPIRED lazily (no scheduler needed). */
  async refreshExpiry(): Promise<void> {
    await this.prisma.document.updateMany({
      where: { type: DocumentType.QUOTE, status: DocumentStatus.SENT, validUntil: { lt: todayUtc() } },
      data: { status: DocumentStatus.EXPIRED },
    });
  }

  buildListWhere(actor: Actor, q: Pick<DocumentListQuery, 'type' | 'status' | 'q' | 'customerId' | 'orderId' | 'from' | 'to' | 'overdue'>): Prisma.DocumentWhereInput {
    const allowed = (Object.values(DocumentType) as DocumentType[]).filter((t) => this.can(actor, readPermission(t)));
    if (allowed.length === 0) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Missing permission quotes.read or invoices.read' });
    if (q.type && !allowed.includes(q.type)) throw new ForbiddenException({ code: 'FORBIDDEN', message: `Missing permission ${readPermission(q.type)}` });
    const where: Prisma.DocumentWhereInput = { type: { in: q.type ? [q.type] : allowed } };
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.orderId) where.orderId = q.orderId;
    if (q.from || q.to) where.issueDate = { ...(q.from ? { gte: parseDate(q.from) } : {}), ...(q.to ? { lte: parseDate(q.to) } : {}) };
    if (q.q) {
      const term = q.q.trim();
      where.OR = ['number', 'customerName', 'customerCompany', 'customerEmail', 'orderReference'].map((f) => ({ [f]: { contains: term, mode: 'insensitive' } }));
    }
    if (q.overdue === 'true') {
      where.AND = [{ status: { in: OPEN_INVOICE } }, { balance: { gt: 0 } }, { dueDate: { lt: todayUtc() } }];
    }
    return where;
  }

  async list(actor: Actor, q: DocumentListQuery): Promise<Paginated<DocumentSummary>> {
    await this.refreshExpiry();
    const where = this.buildListWhere(actor, q);
    const [field, dir] = q.sort.split(':') as [string, 'asc' | 'desc'];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({ where, orderBy: [{ [field]: dir } as Prisma.DocumentOrderByWithRelationInput, { id: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.document.count({ where }),
    ]);
    return new Paginated(rows.map((d) => this.summary(d)), { page: q.page, pageSize: q.pageSize, total });
  }

  async get(actor: Actor, id: string): Promise<DocumentView> {
    await this.refreshExpiry();
    const doc = await this.load(id);
    this.require(actor, readPermission(doc.type));
    return this.view(doc);
  }

  private async load(id: string): Promise<FullDocument> {
    const doc = await this.prisma.document.findUnique({ where: { id }, include: fullInclude });
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    return doc;
  }

  async pdfFor(actor: Actor, id: string): Promise<{ filename: string; buffer: Buffer }> {
    const view = await this.get(actor, id);
    return { filename: `${view.number}.pdf`, buffer: await this.pdf.render(view, await this.settings.getRow()) };
  }

  /** CSV (UTF-8 with BOM, comma separated) of the documents the actor may read. Cells starting with = + - @ are neutralised. */
  async exportCsv(actor: Actor, q: { type?: DocumentType; from?: string; to?: string }): Promise<string> {
    await this.refreshExpiry();
    const where = this.buildListWhere(actor, q);
    const rows = await this.prisma.document.findMany({ where, orderBy: [{ issueDate: 'asc' }, { number: 'asc' }], take: 20_000 });
    const head = ['Numéro', 'Type', 'Statut', 'Date', 'Échéance/Validité', 'Client', 'Entreprise', 'E-mail', 'Devise', 'Sous-total', 'Remise', 'Livraison', 'Taxe', 'Total', 'Payé', 'Solde'];
    const cell = (v: string): string => {
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = rows.map((d) =>
      [d.number, d.type, d.status, day(d.issueDate), d.dueDate ? day(d.dueDate) : d.validUntil ? day(d.validUntil) : '', d.customerName, d.customerCompany ?? '', d.customerEmail, d.currency, d.subtotal.toFixed(2), d.discountAmount.toFixed(2), d.shippingAmount.toFixed(2), d.taxTotal.toFixed(2), d.total.toFixed(2), d.amountPaid.toFixed(2), d.balance.toFixed(2)].map(cell).join(','),
    );
    return `\uFEFF${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Create / update / delete
  // ---------------------------------------------------------------------------------------------------------------

  async create(actor: Actor, dto: CreateDocumentDto, ctx: RequestCtx = {}): Promise<DocumentView> {
    this.require(actor, writePermission(dto.type));
    const settings = await this.settings.getRow();

    let order: OrderWithItems | null = null;
    if (dto.orderId) order = await this.loadOrder(dto.orderId);

    const customer = await this.resolveCustomer(dto, order);
    const lines: DocumentLineDto[] = dto.lines ?? (order ? this.linesFromOrder(order) : []);
    const issue = dto.issueDate ? parseDate(dto.issueDate) : todayUtc();
    const currency = dto.currency ?? order?.currency ?? settings.defaultCurrency;
    const taxRate = dto.taxRate ?? settings.defaultTaxRate.toFixed(2);
    const dueDate =
      dto.dueDate !== undefined ? (dto.dueDate ? parseDate(dto.dueDate) : null) : dto.type === DocumentType.INVOICE ? addDays(issue, settings.paymentTermsDays) : null;
    const validUntil =
      dto.validUntil !== undefined ? (dto.validUntil ? parseDate(dto.validUntil) : null) : dto.type !== DocumentType.INVOICE ? addDays(issue, settings.quoteValidityDays) : null;
    const totals = computeTotals({ lines, discountAmount: dto.discountAmount, shippingAmount: dto.shippingAmount, taxRate });

    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.allocate(tx, dto.type, this.settings.prefixFor(settings, dto.type));
      const doc = await tx.document.create({
        data: {
          type: dto.type,
          number,
          status: DocumentStatus.DRAFT,
          currency,
          issueDate: issue,
          dueDate,
          validUntil,
          customerId: customer.customerId,
          customerName: customer.name,
          customerCompany: customer.company,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          customerCity: customer.city,
          customerCountry: customer.country,
          customerTaxId: customer.taxId,
          orderId: order?.id ?? null,
          orderReference: order?.reference ?? null,
          discountAmount: dto.discountAmount ?? '0',
          shippingAmount: dto.shippingAmount ?? '0',
          taxRate,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          amountPaid: 0,
          balance: totals.total,
          notes: dto.notes ?? null,
          internalNotes: dto.internalNotes ?? null,
          terms: dto.terms !== undefined ? dto.terms : settings.defaultTerms,
          paymentInstructions: dto.paymentInstructions !== undefined ? dto.paymentInstructions : settings.paymentInstructions,
          createdById: actor.id,
          lines: { create: this.lineRows(lines, totals.lineTotals) },
          events: { create: { type: 'STATUS', message: `${TYPE_LABEL[dto.type]} créé (brouillon)`, actorId: actor.id } },
        },
        include: fullInclude,
      });
      await this.audit(tx, actor, 'document.create', doc.id, { number, type: dto.type, orderId: order?.id, total: totals.total.toFixed(2), currency }, ctx);
      if (order) await this.orderEvent(tx, order.id, actor.id, `${TYPE_LABEL[dto.type]} ${number} préparé`, { documentId: doc.id, number });
      return doc;
    });
    return this.view(created);
  }

  async update(actor: Actor, id: string, dto: UpdateDocumentDto, ctx: RequestCtx = {}): Promise<DocumentView> {
    const doc = await this.load(id);
    this.require(actor, writePermission(doc.type));
    const provided = Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);
    if (doc.status === DocumentStatus.VOID) throw new ConflictException({ code: 'DOCUMENT_LOCKED', message: 'A voided document cannot be edited' });
    if (doc.status !== DocumentStatus.DRAFT) {
      const allowed = doc.type === DocumentType.INVOICE ? INVOICE_EDITABLE_AFTER_SENT : QUOTE_EDITABLE_AFTER_SENT;
      const forbidden = provided.filter((k) => !allowed.has(k));
      if (forbidden.length) {
        throw new ConflictException({
          code: 'DOCUMENT_LOCKED',
          message: `A sent ${TYPE_LABEL[doc.type].toLowerCase()} can only change: ${[...allowed].join(', ')}`,
          details: forbidden.map((f) => ({ field: f, messages: ['locked after sending'] })),
        });
      }
    }

    const data: Prisma.DocumentUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.internalNotes !== undefined) data.internalNotes = dto.internalNotes;
    if (dto.terms !== undefined) data.terms = dto.terms;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? parseDate(dto.dueDate) : null;
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil ? parseDate(dto.validUntil) : null;

    let lineRows: Prisma.DocumentLineCreateManyDocumentInput[] | null = null;
    if (doc.status === DocumentStatus.DRAFT) {
      if (dto.paymentInstructions !== undefined) data.paymentInstructions = dto.paymentInstructions;
      if (dto.currency) data.currency = dto.currency;
      if (dto.issueDate) data.issueDate = parseDate(dto.issueDate);
      if (dto.customer || dto.customerId) {
        const c = await this.resolveCustomer({ customer: dto.customer, customerId: dto.customerId }, null, true);
        Object.assign(data, {
          customerId: c.customerId,
          customerName: c.name,
          customerCompany: c.company,
          customerEmail: c.email,
          customerPhone: c.phone,
          customerAddress: c.address,
          customerCity: c.city,
          customerCountry: c.country,
          customerTaxId: c.taxId,
        });
      }
      const lines = dto.lines ?? doc.lines.map(toLineDto);
      const discountAmount = dto.discountAmount ?? doc.discountAmount.toFixed(2);
      const shippingAmount = dto.shippingAmount ?? doc.shippingAmount.toFixed(2);
      const taxRate = dto.taxRate ?? doc.taxRate.toFixed(2);
      const totals = computeTotals({ lines, discountAmount, shippingAmount, taxRate });
      data.discountAmount = discountAmount;
      data.shippingAmount = shippingAmount;
      data.taxRate = taxRate;
      data.subtotal = totals.subtotal;
      data.taxTotal = totals.taxTotal;
      data.total = totals.total;
      data.balance = totals.total.minus(doc.amountPaid);
      if (dto.lines) lineRows = this.lineRows(lines, totals.lineTotals);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (lineRows) {
        await tx.documentLine.deleteMany({ where: { documentId: id } });
        await tx.documentLine.createMany({ data: lineRows.map((l) => ({ ...l, documentId: id })) });
      }
      await tx.document.update({ where: { id }, data });
      await tx.documentEvent.create({ data: { documentId: id, type: 'NOTE', message: `Modifié (${provided.join(', ') || 'aucun champ'})`, actorId: actor.id } });
      await this.audit(tx, actor, 'document.update', id, { number: doc.number, fields: provided }, ctx);
      return tx.document.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
    return this.view(updated);
  }

  async remove(actor: Actor, id: string, ctx: RequestCtx = {}): Promise<{ deleted: true }> {
    const doc = await this.load(id);
    this.require(actor, writePermission(doc.type));
    if (doc.status !== DocumentStatus.DRAFT) throw new ConflictException({ code: 'NOT_DRAFT', message: 'Only drafts can be deleted; void the document instead' });
    await this.prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id } });
      await this.numbering.release(tx, doc.type, doc.number);
      await this.audit(tx, actor, 'document.delete', id, { number: doc.number, type: doc.type }, ctx);
    });
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Lifecycle: convert / duplicate / void / status
  // ---------------------------------------------------------------------------------------------------------------

  async convert(actor: Actor, id: string, to: 'PROFORMA' | 'INVOICE', ctx: RequestCtx = {}): Promise<DocumentView> {
    const src = await this.load(id);
    this.require(actor, readPermission(src.type));
    const target = to as DocumentType;
    this.require(actor, writePermission(target));
    const valid = (src.type === DocumentType.QUOTE && (target === DocumentType.PROFORMA || target === DocumentType.INVOICE)) || (src.type === DocumentType.PROFORMA && target === DocumentType.INVOICE);
    if (!valid) throw new UnprocessableEntityException({ code: 'INVALID_CONVERSION', message: `Cannot convert a ${src.type} into a ${target}` });
    if (src.status === DocumentStatus.VOID || src.status === DocumentStatus.REJECTED) throw new ConflictException({ code: 'INVALID_STATE', message: `A ${src.status} document cannot be converted` });

    const settings = await this.settings.getRow();
    const issue = todayUtc();
    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.allocate(tx, target, this.settings.prefixFor(settings, target));
      const lines = src.lines.map(toLineDto);
      const totals = computeTotals({ lines, discountAmount: src.discountAmount, shippingAmount: src.shippingAmount, taxRate: src.taxRate });
      const doc = await tx.document.create({
        data: {
          type: target,
          number,
          status: DocumentStatus.DRAFT,
          currency: src.currency,
          issueDate: issue,
          dueDate: target === DocumentType.INVOICE ? addDays(issue, settings.paymentTermsDays) : null,
          validUntil: target === DocumentType.PROFORMA ? addDays(issue, settings.quoteValidityDays) : null,
          customerId: src.customerId,
          customerName: src.customerName,
          customerCompany: src.customerCompany,
          customerEmail: src.customerEmail,
          customerPhone: src.customerPhone,
          customerAddress: src.customerAddress,
          customerCity: src.customerCity,
          customerCountry: src.customerCountry,
          customerTaxId: src.customerTaxId,
          orderId: src.orderId,
          orderReference: src.orderReference,
          parentId: src.id,
          discountAmount: src.discountAmount,
          shippingAmount: src.shippingAmount,
          taxRate: src.taxRate,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          balance: totals.total,
          notes: src.notes,
          terms: src.terms,
          paymentInstructions: src.paymentInstructions,
          createdById: actor.id,
          lines: { create: this.lineRows(lines, totals.lineTotals) },
          events: { create: { type: 'CONVERTED', message: `Créé depuis ${src.number}`, actorId: actor.id } },
        },
        include: fullInclude,
      });
      await tx.documentEvent.create({ data: { documentId: src.id, type: 'CONVERTED', message: `Converti en ${number}`, actorId: actor.id, data: { childId: doc.id } } });
      if (src.type === DocumentType.QUOTE && src.status === DocumentStatus.SENT) {
        await tx.document.update({ where: { id: src.id }, data: { status: DocumentStatus.ACCEPTED, acceptedAt: new Date() } });
        await tx.documentEvent.create({ data: { documentId: src.id, type: 'STATUS', message: 'Accepté (converti)', actorId: actor.id } });
      }
      await this.audit(tx, actor, 'document.convert', doc.id, { from: src.number, to: number }, ctx);
      if (src.orderId) await this.orderEvent(tx, src.orderId, actor.id, `${TYPE_LABEL[target]} ${number} préparé depuis ${src.number}`, { documentId: doc.id, number });
      return doc;
    });
    return this.view(created);
  }

  async duplicate(actor: Actor, id: string, ctx: RequestCtx = {}): Promise<DocumentView> {
    const src = await this.load(id);
    this.require(actor, writePermission(src.type));
    const settings = await this.settings.getRow();
    const issue = todayUtc();
    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.allocate(tx, src.type, this.settings.prefixFor(settings, src.type));
      const lines = src.lines.map(toLineDto);
      const totals = computeTotals({ lines, discountAmount: src.discountAmount, shippingAmount: src.shippingAmount, taxRate: src.taxRate });
      const doc = await tx.document.create({
        data: {
          type: src.type,
          number,
          currency: src.currency,
          issueDate: issue,
          dueDate: src.type === DocumentType.INVOICE ? addDays(issue, settings.paymentTermsDays) : null,
          validUntil: src.type !== DocumentType.INVOICE ? addDays(issue, settings.quoteValidityDays) : null,
          customerId: src.customerId,
          customerName: src.customerName,
          customerCompany: src.customerCompany,
          customerEmail: src.customerEmail,
          customerPhone: src.customerPhone,
          customerAddress: src.customerAddress,
          customerCity: src.customerCity,
          customerCountry: src.customerCountry,
          customerTaxId: src.customerTaxId,
          orderId: src.orderId,
          orderReference: src.orderReference,
          discountAmount: src.discountAmount,
          shippingAmount: src.shippingAmount,
          taxRate: src.taxRate,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          balance: totals.total,
          notes: src.notes,
          internalNotes: src.internalNotes,
          terms: src.terms,
          paymentInstructions: src.paymentInstructions,
          createdById: actor.id,
          lines: { create: this.lineRows(lines, totals.lineTotals) },
          events: { create: { type: 'STATUS', message: `Dupliqué depuis ${src.number}`, actorId: actor.id } },
        },
        include: fullInclude,
      });
      await this.audit(tx, actor, 'document.duplicate', doc.id, { from: src.number, to: number }, ctx);
      return doc;
    });
    return this.view(created);
  }

  async voidDocument(actor: Actor, id: string, reason: string, ctx: RequestCtx = {}): Promise<DocumentView> {
    const doc = await this.load(id);
    this.require(actor, writePermission(doc.type));
    if (doc.status === DocumentStatus.VOID) throw new ConflictException({ code: 'INVALID_STATE', message: 'Already void' });
    if (doc.status === DocumentStatus.DRAFT) throw new ConflictException({ code: 'INVALID_STATE', message: 'Delete a draft instead of voiding it' });
    if (doc.payments.some((p) => !p.voidedAt)) throw new ConflictException({ code: 'HAS_PAYMENTS', message: 'Void the recorded payments first' });
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data: { status: DocumentStatus.VOID, voidedAt: new Date(), voidReason: reason } });
      await tx.documentEvent.create({ data: { documentId: id, type: 'STATUS', message: `Annulé : ${reason}`, actorId: actor.id } });
      await this.audit(tx, actor, 'document.void', id, { number: doc.number, reason }, ctx);
      if (doc.orderId) await this.orderEvent(tx, doc.orderId, actor.id, `${TYPE_LABEL[doc.type]} ${doc.number} annulé`, { documentId: id });
      return tx.document.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
    return this.view(updated);
  }

  async setStatus(actor: Actor, id: string, status: 'ACCEPTED' | 'REJECTED', ctx: RequestCtx = {}): Promise<DocumentView> {
    const doc = await this.load(id);
    this.require(actor, writePermission(doc.type));
    if (doc.type === DocumentType.INVOICE) throw new UnprocessableEntityException({ code: 'INVALID_STATE', message: 'Invoices change status through payments' });
    if (doc.status === DocumentStatus.DRAFT || doc.status === DocumentStatus.VOID) throw new ConflictException({ code: 'INVALID_STATE', message: `A ${doc.status} document cannot be ${status}` });
    if (doc.status === (status as DocumentStatus)) throw new ConflictException({ code: 'INVALID_STATE', message: `Already ${status}` });
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data: { status, acceptedAt: status === 'ACCEPTED' ? new Date() : null } });
      await tx.documentEvent.create({ data: { documentId: id, type: 'STATUS', message: status === 'ACCEPTED' ? 'Marqué accepté' : 'Marqué refusé', actorId: actor.id } });
      await this.audit(tx, actor, `document.${status.toLowerCase()}`, id, { number: doc.number }, ctx);
      return tx.document.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
    return this.view(updated);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------------------------------------------

  async send(actor: Actor, id: string, dto: SendDocumentDto, ctx: RequestCtx = {}): Promise<DocumentView> {
    await this.refreshExpiry();
    const doc = await this.load(id);
    this.require(actor, writePermission(doc.type));
    if (doc.status === DocumentStatus.VOID) throw new ConflictException({ code: 'INVALID_STATE', message: 'A voided document cannot be sent' });
    if (doc.lines.length === 0) throw new UnprocessableEntityException({ code: 'EMPTY_DOCUMENT', message: 'Add at least one line before sending' });

    const to = dto.to?.length ? dto.to : [doc.customerEmail];
    const token = doc.publicToken ?? randomBytes(32).toString('base64url');
    let messageId: string | null = null;

    if (!dto.markAsSentOnly) {
      const withToken = await this.prisma.document.findUniqueOrThrow({ where: { id }, include: fullInclude });
      const view = await this.view({ ...withToken, publicToken: token });
      const buffer = await this.pdf.render(view, await this.settings.getRow());
      const link = `${this.baseUrl()}/api/v1/public/documents/${token}/pdf`;
      const subject = dto.subject?.trim() || `${TYPE_LABEL[doc.type]} ${doc.number} — Impact Pro`;
      const intro = dto.message?.trim() || `Bonjour ${doc.customerName},\n\nVeuillez trouver ci-joint votre ${TYPE_LABEL[doc.type].toLowerCase()} ${doc.number}.`;
      const text = `${intro}\n\nMontant : ${money(view.total)} ${view.currency}\nTélécharger le document : ${link}\n\nCordialement,\nImpact Pro`;
      const html = `<p>${escapeHtml(intro).replace(/\n/g, '<br>')}</p><p><strong>Montant :</strong> ${escapeHtml(money(view.total))} ${view.currency}<br><a href="${escapeHtml(link)}">Télécharger le document (PDF)</a></p><p>Cordialement,<br>Impact Pro</p>`;
      try {
        const sent = await this.mailer.send({
          to,
          cc: dto.cc,
          bcc: dto.bcc,
          subject,
          text,
          html,
          attachments: [{ filename: `${doc.number}.pdf`, content: buffer, contentType: 'application/pdf' }],
          context: { documentId: id, orderId: doc.orderId ?? undefined, customerId: doc.customerId ?? undefined, actorId: actor.id },
        });
        messageId = sent.messageId;
      } catch (e) {
        if (e instanceof MailNotConfiguredError) {
          throw new ServiceUnavailableException({ code: 'MAIL_NOT_CONFIGURED', message: "Le service d'e-mail n'est pas configuré (utilisez markAsSentOnly pour enregistrer un envoi par un autre canal)" });
        }
        throw e;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id },
        data: { publicToken: token, sentAt: new Date(), sentTo: to, ...(doc.status === DocumentStatus.DRAFT ? { status: DocumentStatus.SENT } : {}) },
      });
      const message = dto.markAsSentOnly ? `Envoyé par un autre canal à ${to.join(', ')}` : `Envoyé par e-mail à ${to.join(', ')}`;
      await tx.documentEvent.create({ data: { documentId: id, type: 'SENT', message, actorId: actor.id, data: { to, messageId, markAsSentOnly: Boolean(dto.markAsSentOnly) } } });
      await this.audit(tx, actor, 'document.send', id, { number: doc.number, to, markAsSentOnly: Boolean(dto.markAsSentOnly) }, ctx);
      if (doc.orderId) await this.orderEvent(tx, doc.orderId, actor.id, `${TYPE_LABEL[doc.type]} ${doc.number} envoyé`, { documentId: id, number: doc.number, to });
      return tx.document.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
    return this.view(updated);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------------------------------------------

  async addPayment(actor: Actor, id: string, dto: RecordPaymentDto, ctx: RequestCtx = {}): Promise<DocumentView> {
    this.require(actor, 'payments.write');
    const amount = new D(dto.amount);
    if (amount.lte(0)) throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'amount', messages: ['amount must be greater than 0'] }] });
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${id} FOR UPDATE`;
      const doc = await tx.document.findUnique({ where: { id }, include: { payments: true } });
      if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
      if (doc.type !== DocumentType.INVOICE) throw new ConflictException({ code: 'INVALID_STATE', message: 'Payments are recorded on invoices only' });
      if (doc.status === DocumentStatus.DRAFT || doc.status === DocumentStatus.VOID) throw new ConflictException({ code: 'INVALID_STATE', message: `A ${doc.status} invoice cannot receive payments` });
      if (amount.gt(doc.balance)) {
        throw new UnprocessableEntityException({ code: 'OVERPAYMENT', message: `Amount exceeds the balance due (${doc.balance.toFixed(2)} ${doc.currency})`, details: [{ field: 'amount', messages: ['exceeds the balance due'] }] });
      }
      const payment = await tx.payment.create({
        data: { documentId: id, amount, currency: doc.currency, method: dto.method, paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(), reference: dto.reference ?? null, notes: dto.notes ?? null, recordedById: actor.id },
      });
      const paid = await this.settle(tx, id, doc.total);
      await tx.documentEvent.create({ data: { documentId: id, type: 'PAYMENT', message: `Paiement de ${amount.toFixed(2)} ${doc.currency} (${dto.method})`, actorId: actor.id, data: { paymentId: payment.id } } });
      await this.audit(tx, actor, 'payment.record', id, { number: doc.number, paymentId: payment.id, amount: amount.toFixed(2), method: dto.method, status: paid.status }, ctx);
      if (doc.orderId) await this.orderEvent(tx, doc.orderId, actor.id, `Paiement de ${amount.toFixed(2)} ${doc.currency} sur ${doc.number}`, { documentId: id, paymentId: payment.id });
      return tx.document.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
    return this.view(updated);
  }

  async voidPayment(actor: Actor, id: string, paymentId: string, reason: string, ctx: RequestCtx = {}): Promise<DocumentView> {
    this.require(actor, 'payments.write');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${id} FOR UPDATE`;
      const doc = await tx.document.findUnique({ where: { id } });
      if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
      const payment = await tx.payment.findFirst({ where: { id: paymentId, documentId: id } });
      if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
      if (payment.voidedAt) throw new ConflictException({ code: 'INVALID_STATE', message: 'Payment already void' });
      if (doc.status === DocumentStatus.VOID) throw new ConflictException({ code: 'INVALID_STATE', message: 'The invoice is void' });
      await tx.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: reason } });
      const settled = await this.settle(tx, id, doc.total);
      await tx.documentEvent.create({ data: { documentId: id, type: 'PAYMENT', message: `Paiement annulé (${payment.amount.toFixed(2)} ${doc.currency}) : ${reason}`, actorId: actor.id, data: { paymentId } } });
      await this.audit(tx, actor, 'payment.void', id, { number: doc.number, paymentId, reason, status: settled.status }, ctx);
      return tx.document.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
    return this.view(updated);
  }

  /** Recomputes `amountPaid`, `balance` and the invoice status from the non-voided payments (call under the row lock). */
  private async settle(tx: Prisma.TransactionClient, id: string, total: Prisma.Decimal): Promise<{ status: DocumentStatus; paid: Prisma.Decimal }> {
    const agg = await tx.payment.aggregate({ where: { documentId: id, voidedAt: null }, _sum: { amount: true } });
    const paid = agg._sum.amount ?? new D(0);
    const status = paid.lte(0) ? DocumentStatus.SENT : paid.gte(total) ? DocumentStatus.PAID : DocumentStatus.PARTIALLY_PAID;
    await tx.document.update({ where: { id }, data: { amountPaid: paid, balance: total.minus(paid), status } });
    return { status, paid };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Public (customer) access through the unguessable token
  // ---------------------------------------------------------------------------------------------------------------

  private async byToken(token: string): Promise<FullDocument> {
    await this.refreshExpiry();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    const doc = await this.prisma.document.findUnique({ where: { publicToken: token }, include: fullInclude });
    if (!doc || doc.status === DocumentStatus.DRAFT) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    return doc;
  }

  async publicView(token: string): Promise<PublicDocumentView> {
    const doc = await this.byToken(token);
    const s = await this.settings.getRow();
    return {
      type: doc.type,
      number: doc.number,
      status: doc.status,
      currency: doc.currency,
      issueDate: day(doc.issueDate),
      dueDate: doc.dueDate ? day(doc.dueDate) : null,
      validUntil: doc.validUntil ? day(doc.validUntil) : null,
      company: { legalName: s.legalName, address: s.address, city: s.city, country: s.country, phone: s.phone, email: s.email, website: s.website, taxId: s.taxId },
      customer: { name: doc.customerName, company: doc.customerCompany, email: doc.customerEmail },
      lines: doc.lines.map((l) => ({ position: l.position, description: l.description, quantity: trimQty(l.quantity), unit: l.unit, unitPrice: l.unitPrice.toFixed(2), discountPercent: l.discountPercent.toFixed(2), lineTotal: l.lineTotal.toFixed(2) })),
      discountAmount: doc.discountAmount.toFixed(2),
      shippingAmount: doc.shippingAmount.toFixed(2),
      taxRate: doc.taxRate.toFixed(2),
      subtotal: doc.subtotal.toFixed(2),
      taxTotal: doc.taxTotal.toFixed(2),
      total: doc.total.toFixed(2),
      amountPaid: doc.amountPaid.toFixed(2),
      balance: doc.balance.toFixed(2),
      notes: doc.notes,
      terms: doc.terms,
      paymentInstructions: doc.paymentInstructions,
      acceptedAt: iso(doc.acceptedAt),
      canAccept: doc.type !== DocumentType.INVOICE && doc.status === DocumentStatus.SENT,
    };
  }

  async publicPdf(token: string): Promise<{ filename: string; buffer: Buffer }> {
    const doc = await this.byToken(token);
    return { filename: `${doc.number}.pdf`, buffer: await this.pdf.render(this.toView(doc), await this.settings.getRow()) };
  }

  async publicAccept(token: string, ctx: RequestCtx = {}): Promise<PublicDocumentView> {
    const doc = await this.byToken(token);
    if (doc.type === DocumentType.INVOICE) throw new ConflictException({ code: 'INVALID_STATE', message: 'An invoice cannot be accepted' });
    if (doc.status === DocumentStatus.ACCEPTED) return this.publicView(token); // idempotent
    if (doc.status !== DocumentStatus.SENT) throw new ConflictException({ code: 'INVALID_STATE', message: `This document is ${doc.status.toLowerCase()} and cannot be accepted` });
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: doc.id }, data: { status: DocumentStatus.ACCEPTED, acceptedAt: new Date(), acceptedIp: ctx.ipAddress ?? null } });
      await tx.documentEvent.create({ data: { documentId: doc.id, type: 'ACCEPTED', message: 'Accepté par le client (lien public)', data: { ip: ctx.ipAddress ?? null } } });
      await tx.auditLog.create({ data: { action: 'document.accept.public', entityType: 'Document', entityId: doc.id, metadata: { number: doc.number }, ipAddress: ctx.ipAddress ?? null, requestId: ctx.requestId ?? null } });
      if (doc.orderId) await this.orderEvent(tx, doc.orderId, null, `${TYPE_LABEL[doc.type]} ${doc.number} accepté par le client`, { documentId: doc.id });
    });
    return this.publicView(token);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------------------------

  baseUrl(): string {
    return (this.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
  }

  private lineRows(lines: DocumentLineDto[], totals: Prisma.Decimal[]): Prisma.DocumentLineCreateManyDocumentInput[] {
    return lines.map((l, i) => ({
      position: i + 1,
      description: l.description,
      sku: l.sku ?? null,
      productId: l.productId ?? null,
      quantity: l.quantity,
      unit: l.unit ?? null,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent ?? '0',
      lineTotal: totals[i],
    }));
  }

  private async loadOrder(orderId: string) {
    const order = await this.prisma.customOrder.findFirst({
      where: { OR: [{ id: orderId }, { reference: orderId }] },
      include: { items: { orderBy: { lineNo: 'asc' }, include: { elements: { select: { placement: true } } } } },
    });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    return order;
  }

  /** Lines prefilled from the order snapshot: product + options + print zones, quantity and unit price as ordered. */
  private linesFromOrder(order: OrderWithItems): DocumentLineDto[] {
    return order.items.map((it) => {
      const zones = [...new Set(it.elements.map((e) => e.placement).filter((p): p is NonNullable<typeof p> => Boolean(p)))].map((p) => ZONE_LABEL[p] ?? p);
      const opts = [it.color && `Couleur : ${it.color}`, it.size && `Taille : ${it.size}`, it.widthCm && it.heightCm && `${it.widthCm.toFixed(0)} × ${it.heightCm.toFixed(0)} cm`, zones.length && `Zones : ${zones.join(', ')}`].filter(Boolean);
      return {
        description: opts.length ? `${it.productName} — ${opts.join(' · ')}` : it.productName,
        sku: it.productSlug,
        productId: it.productId,
        quantity: String(it.quantity),
        unit: null,
        unitPrice: it.unitPrice.toFixed(2),
        discountPercent: '0',
      } as DocumentLineDto;
    });
  }

  private async resolveCustomer(
    src: { customer?: CreateDocumentDto['customer']; customerId?: string },
    order: OrderWithItems | null,
    requireSource = false,
  ): Promise<{ customerId: string | null; name: string; company: string | null; email: string; phone: string | null; address: string | null; city: string | null; country: string | null; taxId: string | null }> {
    if (src.customer) {
      const c = src.customer;
      return { customerId: src.customerId ?? null, name: c.name, company: c.company ?? null, email: c.email, phone: c.phone ?? null, address: c.address ?? null, city: c.city ?? null, country: c.country ?? null, taxId: c.taxId ?? null };
    }
    if (src.customerId && (await this.tableExists('Customer'))) {
      const rows = await this.prisma.$queryRaw<Record<string, string | null>[]>`SELECT "id", "email", "fullName", "company", "phone", "address", "city", "country", "taxId" FROM "Customer" WHERE "id" = ${src.customerId}`;
      const r = rows[0];
      if (!r) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
      return { customerId: r.id, name: r.fullName ?? r.email ?? '', company: r.company ?? null, email: r.email ?? '', phone: r.phone ?? null, address: r.address ?? null, city: r.city ?? null, country: r.country ?? null, taxId: r.taxId ?? null };
    }
    if (order) {
      return { customerId: null, name: order.customerName, company: order.company, email: order.email, phone: order.phone, address: order.address, city: order.city, country: null, taxId: null };
    }
    if (requireSource || src.customerId !== undefined) {
      throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'customer', messages: ['provide `customer` (name, email…) — the customer directory is not available'] }] });
    }
    throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'customer', messages: ['provide `customerId`, `customer` or `orderId`'] }] });
  }

  private tableCache = new Map<string, boolean>();
  private async tableExists(name: string): Promise<boolean> {
    if (this.tableCache.get(name)) return true;
    const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`SELECT to_regclass(${`"${name}"`}) IS NOT NULL AS ok`;
    const ok = Boolean(rows[0]?.ok);
    if (ok) this.tableCache.set(name, true);
    return ok;
  }

  /** Adds an order timeline entry when the admin core's `CustomOrderEvent` table exists; silently skipped otherwise. */
  private async orderEvent(tx: Prisma.TransactionClient, orderId: string, actorId: string | null, message: string, data: Record<string, unknown>): Promise<void> {
    if (!(await this.tableExists('CustomOrderEvent'))) return;
    try {
      await tx.$executeRaw`INSERT INTO "CustomOrderEvent" ("id", "orderId", "type", "message", "data", "actorId", "createdAt") VALUES (${`bil_${randomBytes(12).toString('hex')}`}, ${orderId}, 'DOCUMENT', ${message}, ${JSON.stringify(data)}::jsonb, ${actorId}, now())`;
    } catch {
      // The table shape is owned by another module; never fail billing because of the timeline.
    }
  }

  private audit(tx: Prisma.TransactionClient, actor: Actor, action: string, entityId: string, metadata: Record<string, unknown>, ctx: RequestCtx) {
    return tx.auditLog.create({
      data: { action, entityType: 'Document', entityId, actorId: actor.id, metadata: metadata as Prisma.InputJsonValue, ipAddress: ctx.ipAddress ?? null, requestId: ctx.requestId ?? null },
    });
  }

  summary(d: Pick<FullDocument, 'id' | 'type' | 'number' | 'status' | 'currency' | 'total' | 'balance' | 'issueDate' | 'dueDate' | 'customerName' | 'createdAt'>): DocumentSummary {
    return {
      id: d.id,
      type: d.type,
      number: d.number,
      status: d.status,
      isOverdue: isOverdue(d),
      currency: d.currency,
      total: d.total.toFixed(2),
      balance: d.balance.toFixed(2),
      issueDate: day(d.issueDate),
      customerName: d.customerName,
      createdAt: d.createdAt.toISOString(),
    };
  }

  /** Serialises with staff display names resolved (one bulk query for new ids). */
  async view(d: FullDocument): Promise<DocumentView> {
    await this.hydrateNames([d.createdById, ...d.payments.map((p) => p.recordedById), ...d.events.map((e) => e.actorId)]);
    return this.toView(d);
  }

  toView(d: FullDocument): DocumentView {
    const base = this.baseUrl();
    const lines: DocumentLineView[] = d.lines.map((l) => ({
      id: l.id,
      position: l.position,
      description: l.description,
      sku: l.sku,
      productId: l.productId,
      quantity: trimQty(l.quantity),
      unit: l.unit,
      unitPrice: l.unitPrice.toFixed(2),
      discountPercent: l.discountPercent.toFixed(2),
      lineTotal: l.lineTotal.toFixed(2),
    }));
    const payments: PaymentView[] = d.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toFixed(2),
      currency: p.currency,
      method: p.method,
      paidAt: p.paidAt.toISOString(),
      reference: p.reference,
      notes: p.notes,
      voidedAt: iso(p.voidedAt),
      voidReason: p.voidReason,
      recordedBy: p.recordedById ? { id: p.recordedById, name: this.nameCache.get(p.recordedById) ?? '' } : null,
    }));
    const events: DocumentEventView[] = d.events.map((e) => ({ id: e.id, type: e.type, message: e.message, actor: e.actorId ? { id: e.actorId, name: this.nameCache.get(e.actorId) ?? '' } : null, createdAt: e.createdAt.toISOString() }));
    return {
      id: d.id,
      type: d.type,
      number: d.number,
      status: d.status,
      isOverdue: isOverdue(d),
      currency: d.currency,
      issueDate: day(d.issueDate),
      dueDate: d.dueDate ? day(d.dueDate) : null,
      validUntil: d.validUntil ? day(d.validUntil) : null,
      customerId: d.customerId,
      customer: { name: d.customerName, company: d.customerCompany, email: d.customerEmail, phone: d.customerPhone, address: d.customerAddress, city: d.customerCity, country: d.customerCountry, taxId: d.customerTaxId },
      orderId: d.orderId,
      orderReference: d.orderReference,
      parentId: d.parentId,
      parentNumber: d.parent?.number ?? null,
      children: d.children.map((c) => ({ id: c.id, type: c.type, number: c.number })),
      lines,
      discountAmount: d.discountAmount.toFixed(2),
      shippingAmount: d.shippingAmount.toFixed(2),
      taxRate: d.taxRate.toFixed(2),
      subtotal: d.subtotal.toFixed(2),
      taxTotal: d.taxTotal.toFixed(2),
      total: d.total.toFixed(2),
      amountPaid: d.amountPaid.toFixed(2),
      balance: d.balance.toFixed(2),
      notes: d.notes,
      internalNotes: d.internalNotes,
      terms: d.terms,
      paymentInstructions: d.paymentInstructions,
      sentAt: iso(d.sentAt),
      sentTo: d.sentTo,
      acceptedAt: iso(d.acceptedAt),
      publicToken: d.publicToken,
      publicUrl: d.publicToken ? `${base}/api/v1/public/documents/${d.publicToken}` : null,
      voidedAt: iso(d.voidedAt),
      voidReason: d.voidReason,
      createdBy: d.createdById ? { id: d.createdById, name: this.nameCache.get(d.createdById) ?? '' } : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      payments,
      events,
    };
  }

  /** Staff display names for the views, refreshed in bulk before serialising (see `hydrateNames`). */
  private nameCache = new Map<string, string>();

  async hydrateNames(ids: (string | null | undefined)[]): Promise<void> {
    const missing = [...new Set(ids.filter((x): x is string => Boolean(x) && !this.nameCache.has(x as string)))];
    if (!missing.length) return;
    const users = await this.prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, email: true, fullName: true, firstName: true, lastName: true } });
    for (const u of users) this.nameCache.set(u.id, displayName(u));
  }
}

function displayName(u: { email: string; fullName: string | null; firstName: string | null; lastName: string | null }): string {
  return u.fullName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
}

function isOverdue(d: { status: DocumentStatus; dueDate: Date | null; balance: Prisma.Decimal }): boolean {
  return Boolean(d.dueDate && d.dueDate < todayUtc() && d.balance.gt(0) && OPEN_INVOICE.includes(d.status));
}

function toLineDto(l: { description: string; sku: string | null; productId: string | null; quantity: Prisma.Decimal; unit: string | null; unitPrice: Prisma.Decimal; discountPercent: Prisma.Decimal }): DocumentLineDto {
  return { description: l.description, sku: l.sku, productId: l.productId, quantity: trimQty(l.quantity), unit: l.unit, unitPrice: l.unitPrice.toFixed(2), discountPercent: l.discountPercent.toFixed(2) };
}

/** `12.000` → `12`, `2.500` → `2.5` */
function trimQty(q: Prisma.Decimal): string {
  return q.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function money(v: string): string {
  const [int, dec] = v.split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec ?? '00'}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
