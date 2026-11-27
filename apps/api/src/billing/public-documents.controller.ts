import { Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { publicDocumentThrottle } from '../common/throttle-limits';
import type { PublicDocumentView } from './billing.types';
import { DocumentsService } from './documents.service';

/** Customer-facing links (no login): the unguessable token is the credential. Only documents that were sent are reachable. */
@ApiTags('public')
@Throttle(publicDocumentThrottle)
@Controller({ path: 'public/documents', version: '1' })
export class PublicDocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Limited view of a sent document (no internal notes or history)' })
  view(@Param('token') token: string): Promise<PublicDocumentView> {
    return this.docs.publicView(token);
  }

  @Get(':token/pdf')
  @ApiOperation({ summary: 'PDF of a sent document' })
  async pdf(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const { filename, buffer } = await this.docs.publicPdf(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buffer);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept a sent quote / proforma (records time and IP; idempotent)' })
  accept(@Param('token') token: string, @Req() req: Request & { id?: string }): Promise<PublicDocumentView> {
    return this.docs.publicAccept(token, { ipAddress: req.ip, requestId: req.id });
  }
}
