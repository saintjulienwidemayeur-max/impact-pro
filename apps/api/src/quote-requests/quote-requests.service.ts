import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, UploadPurpose, type QuoteRequestService, type QuoteRequestStatus } from '@prisma/client';
import { AuditService, type ActorContext } from '../common/audit.service';
import { pageMeta, parseSort, skipTake } from '../common/pagination';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_FROM_FORM, type CreateQuoteRequestDto, type ListQuoteRequestsQuery, type UpdateQuoteRequestDto } from './quote-requests.dto';

export interface QuoteRequestView {
  id: string;
  reference: string;
  service: QuoteRequestService;
  size: string | null;
  status: QuoteRequestStatus;
  fullName: string;
  company: string | null;
  phone: string;
  email: string;
  project: string;
  quantity: number | null;
  message: string | null;
  logo: { id: string; originalName: string; mimeType: string; url: string } | null;
  customerId: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const INCLUDE = { logoUpload: { select: { id: true, originalName: true, mimeType: true } } } as const;
type Row = Prisma.QuoteRequestGetPayload<{ include: typeof INCLUDE }>;

export const formatQuoteReference = (seq: bigint | number, year: number): string => `DMD-${year}-${String(seq).padStart(6, '0')}`;

const notFound = () => new NotFoundException({ code: 'QUOTE_REQUEST_NOT_FOUND', message: 'Quote request not found' });

function view(r: Row): QuoteRequestView {
  return {
    id: r.id,
    reference: r.reference,
    service: r.service,
    size: r.size,
    status: r.status,
    fullName: r.fullName,
    company: r.company,
    phone: r.phone,
    email: r.email,
    project: r.project,
    quantity: r.quantity,
    message: r.message,
    logo: r.logoUpload ? { ...r.logoUpload, url: `/api/v1/uploads/logos/${r.logoUpload.id}` } : null,
    customerId: r.customerId,
    internalNote: r.internalNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class QuoteRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly audit: AuditService,
  ) {}

  /** Public form submission: stores the request and files the sender in the customer directory. */
  async create(dto: CreateQuoteRequestDto, ctx: { ipAddress?: string; userId?: string }): Promise<{ reference: string; status: QuoteRequestStatus; createdAt: string }> {
    if (dto.logoUploadId) {
      const upload = await this.prisma.upload.findUnique({ where: { id: dto.logoUploadId }, select: { purpose: true } });
      if (!upload || upload.purpose !== UploadPurpose.LOGO) {
        throw new UnprocessableEntityException({ code: 'UPLOAD_NOT_FOUND', message: 'The logo was not found, upload it again', details: [{ field: 'logoUploadId', messages: ['upload not found'] }] });
      }
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('quote_request_ref_seq')`;
      const customerId = await this.customers.upsertFromOrder({ email: dto.email, fullName: dto.name, company: dto.company, phone: dto.phone }, ctx.userId, tx);
      return tx.quoteRequest.create({
        data: {
          reference: formatQuoteReference(nextval, new Date().getUTCFullYear()),
          service: SERVICE_FROM_FORM[dto.service],
          size: dto.size ?? null,
          fullName: dto.name,
          company: dto.company ?? null,
          phone: dto.phone,
          email: dto.email,
          project: dto.products,
          quantity: dto.quantity ?? null,
          message: dto.message ?? null,
          logoUploadId: dto.logoUploadId ?? null,
          customerId,
          ipAddress: ctx.ipAddress ?? null,
        },
      });
    });
    return { reference: created.reference, status: created.status, createdAt: created.createdAt.toISOString() };
  }

  async list(q: ListQuoteRequestsQuery) {
    const where: Prisma.QuoteRequestWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.service ? { service: q.service } : {}),
      ...(q.q
        ? {
            OR: [
              { reference: { contains: q.q, mode: 'insensitive' } },
              { fullName: { contains: q.q, mode: 'insensitive' } },
              { company: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
              { phone: { contains: q.q, mode: 'insensitive' } },
              { project: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = parseSort<Prisma.QuoteRequestOrderByWithRelationInput>(
      q.sort,
      { createdAt: (d) => ({ createdAt: d }), status: (d) => ({ status: d }), fullName: (d) => ({ fullName: d }) },
      { createdAt: 'desc' },
    );
    const [total, rows, newCount] = await this.prisma.$transaction([
      this.prisma.quoteRequest.count({ where }),
      this.prisma.quoteRequest.findMany({ where, include: INCLUDE, orderBy: [orderBy, { id: 'asc' }], ...skipTake(q) }),
      this.prisma.quoteRequest.count({ where: { status: 'NEW' } }),
    ]);
    return { items: rows.map(view), meta: { ...pageMeta(q, total), newCount } };
  }

  async detail(id: string): Promise<QuoteRequestView> {
    const r = await this.prisma.quoteRequest.findUnique({ where: { id }, include: INCLUDE });
    if (!r) throw notFound();
    return view(r);
  }

  async update(id: string, dto: UpdateQuoteRequestDto, actor: ActorContext): Promise<QuoteRequestView> {
    const before = await this.prisma.quoteRequest.findUnique({ where: { id }, select: { status: true, reference: true } });
    if (!before) throw notFound();
    const data: Prisma.QuoteRequestUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.internalNote !== undefined) data.internalNote = dto.internalNote;
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.quoteRequest.update({ where: { id }, data, include: INCLUDE });
      await this.audit.record(
        actor,
        {
          action: dto.status && dto.status !== before.status ? 'quote_request.status_change' : 'quote_request.update',
          entityType: 'QuoteRequest',
          entityId: id,
          metadata: { reference: before.reference, from: before.status, to: r.status, noteChanged: dto.internalNote !== undefined },
        },
        tx,
      );
      return r;
    });
    return view(updated);
  }
}
