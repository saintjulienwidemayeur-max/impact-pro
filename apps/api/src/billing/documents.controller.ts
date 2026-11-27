import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { StaffGuard } from '../admin/rbac/staff.guard';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { OriginGuard, SessionGuard } from '../auth/guards';
import { Paginated } from '../common/response.interceptor';
import type { DocumentSummary, DocumentView } from './billing.types';
import {
  ConvertDocumentDto,
  CreateDocumentDto,
  DocumentListQuery,
  ExportQuery,
  RecordPaymentDto,
  SendDocumentDto,
  SetStatusDto,
  UpdateDocumentDto,
  VoidDto,
} from './dto/billing.dto';
import { DocumentsService, type RequestCtx } from './documents.service';

const ctxOf = (req: Request & { id?: string }): RequestCtx => ({ ipAddress: req.ip, requestId: req.id });

/**
 * Quotes, proformas and invoices. Permissions are per document type (`quotes.*` for QUOTE/PROFORMA, `invoices.*` for INVOICE,
 * `payments.write` for payments) and are enforced in the service, because they depend on the document.
 */
@ApiTags('billing')
@ApiCookieAuth('ip_session')
@UseGuards(OriginGuard, SessionGuard, StaffGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHENTICATED' })
@ApiForbiddenResponse({ description: 'FORBIDDEN (not staff / missing permission)' })
@Controller({ path: 'admin/documents', version: '1' })
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents (filters: type, status, q, customerId, orderId, from, to, overdue)' })
  async list(@CurrentAuth() auth: AuthContext, @Query() q: DocumentListQuery): Promise<Paginated<DocumentSummary>> {
    return this.docs.list(await this.docs.actor(auth.user.id), q);
  }

  /** Declared before `:id` so « export.csv » is not taken for an id. */
  @Get('export.csv')
  @ApiOperation({ summary: 'CSV export (needs reports.read)' })
  async exportCsv(@CurrentAuth() auth: AuthContext, @Query() q: ExportQuery, @Res() res: Response): Promise<void> {
    const actor = await this.docs.actor(auth.user.id);
    if (!this.docs.can(actor, 'reports.read')) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Missing permission reports.read' } });
      return;
    }
    const csv = await this.docs.exportCsv(actor, q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="documents-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  @Post()
  @ApiOperation({ summary: 'Create a draft (optionally prefilled from an order)' })
  async create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateDocumentDto, @Req() req: Request): Promise<DocumentView> {
    return this.docs.create(await this.docs.actor(auth.user.id), dto, ctxOf(req));
  }

  @Get(':id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DocumentView> {
    return this.docs.get(await this.docs.actor(auth.user.id), id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'PDF (inline)' })
  @ApiOkResponse({ description: 'application/pdf' })
  async pdf(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const { filename, buffer } = await this.docs.pdfFor(await this.docs.actor(auth.user.id), id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit: a draft fully; after sending only notes / dates / terms (invoices: internal notes only)' })
  async update(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateDocumentDto, @Req() req: Request): Promise<DocumentView> {
    return this.docs.update(await this.docs.actor(auth.user.id), id, dto, ctxOf(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a draft' })
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Req() req: Request): Promise<{ deleted: true }> {
    return this.docs.remove(await this.docs.actor(auth.user.id), id, ctxOf(req));
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Quote → proforma/invoice, proforma → invoice (new linked draft)' })
  async convert(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: ConvertDocumentDto, @Req() req: Request): Promise<DocumentView> {
    return this.docs.convert(await this.docs.actor(auth.user.id), id, dto.to, ctxOf(req));
  }

  @Post(':id/duplicate')
  async duplicate(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Req() req: Request): Promise<DocumentView> {
    return this.docs.duplicate(await this.docs.actor(auth.user.id), id, ctxOf(req));
  }

  @Post(':id/void')
  @HttpCode(200)
  async void(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: VoidDto, @Req() req: Request): Promise<DocumentView> {
    return this.docs.voidDocument(await this.docs.actor(auth.user.id), id, dto.reason, ctxOf(req));
  }

  @Post(':id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a quote / proforma ACCEPTED or REJECTED' })
  async status(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: SetStatusDto, @Req() req: Request): Promise<DocumentView> {
    return this.docs.setStatus(await this.docs.actor(auth.user.id), id, dto.status, ctxOf(req));
  }

  @Post(':id/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'E-mail the PDF to the customer (503 MAIL_NOT_CONFIGURED without a mail provider; markAsSentOnly records another channel)' })
  async send(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: SendDocumentDto, @Req() req: Request): Promise<DocumentView> {
    return this.docs.send(await this.docs.actor(auth.user.id), id, dto, ctxOf(req));
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a payment on an invoice (needs payments.write)' })
  async addPayment(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: RecordPaymentDto, @Req() req: Request): Promise<DocumentView> {
    return this.docs.addPayment(await this.docs.actor(auth.user.id), id, dto, ctxOf(req));
  }

  @Post(':id/payments/:paymentId/void')
  @HttpCode(200)
  async voidPayment(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: VoidDto,
    @Req() req: Request,
  ): Promise<DocumentView> {
    return this.docs.voidPayment(await this.docs.actor(auth.user.id), id, paymentId, dto.reason, ctxOf(req));
  }
}
