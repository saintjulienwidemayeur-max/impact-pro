import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorOf } from '../admin/admin-context';
import { RequirePermission, StaffGuard } from '../admin/staff.guard';
import type { AuthContext, AuthedRequest } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { OriginGuard } from '../auth/guards';
import { SessionService } from '../auth/session.service';
import { Paginated } from '../common/response.interceptor';
import { orderThrottle } from '../common/throttle-limits';
import { CreateQuoteRequestDto, ListQuoteRequestsQuery, UpdateQuoteRequestDto } from './quote-requests.dto';
import { QuoteRequestsService, type QuoteRequestView } from './quote-requests.service';

@ApiTags('quote-requests')
@Controller({ path: 'quote-requests', version: '1' })
export class QuoteRequestsController {
  constructor(
    private readonly requests: QuoteRequestsService,
    private readonly sessions: SessionService,
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle(orderThrottle)
  @UseGuards(OriginGuard)
  @ApiOperation({ summary: 'Request a proforma (promotional items, sourcing, event or consulting) from the storefront' })
  @ApiCreatedResponse({ description: '{ data: { reference, status, createdAt } }' })
  @ApiUnprocessableEntityResponse({ description: 'VALIDATION_ERROR · UPLOAD_NOT_FOUND' })
  @ApiTooManyRequestsResponse({ description: 'Rate limited' })
  async create(@Body() dto: CreateQuoteRequestDto, @Req() req: Request) {
    const auth = await this.sessions.userForRequest(req);
    return this.requests.create(dto, { ipAddress: req.ip, userId: auth?.user.id });
  }
}

@ApiTags('admin · quote requests')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/quote-requests', version: '1' })
export class AdminQuoteRequestsController {
  constructor(private readonly requests: QuoteRequestsService) {}

  @Get()
  @RequirePermission('quotes.read')
  @ApiOperation({ summary: 'Proforma requests from the storefront (filter by status / service, search); meta.newCount = unanswered requests' })
  async list(@Query() q: ListQuoteRequestsQuery): Promise<Paginated<QuoteRequestView>> {
    const { items, meta } = await this.requests.list(q);
    return new Paginated(items, meta);
  }

  @Get(':id')
  @RequirePermission('quotes.read')
  @ApiNotFoundResponse({ description: 'QUOTE_REQUEST_NOT_FOUND' })
  detail(@Param('id') id: string): Promise<QuoteRequestView> {
    return this.requests.detail(id);
  }

  @Patch(':id')
  @RequirePermission('quotes.write')
  @ApiOperation({ summary: 'Change the follow-up status and/or the internal note' })
  update(@Param('id') id: string, @Body() dto: UpdateQuoteRequestDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<QuoteRequestView> {
    return this.requests.update(id, dto, actorOf(req, auth));
  }
}
