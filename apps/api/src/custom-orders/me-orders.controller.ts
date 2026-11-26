import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { ClaimOrderDto } from '../auth/dto/auth.dto';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { OriginGuard, SessionGuard } from '../auth/guards';
import { Paginated } from '../common/response.interceptor';
import { CustomOrdersService, type CustomOrderSummary, type CustomOrderView } from './custom-orders.service';

class MyOrdersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;
}

/** « Mes commandes »: the signed-in customer's own orders. Another user's order is always a 404. */
@ApiTags('me')
@ApiCookieAuth('ip_session')
@UseGuards(OriginGuard, SessionGuard)
@Controller({ path: 'me/orders', version: '1' })
export class MeOrdersController {
  constructor(private readonly orders: CustomOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated list of my orders (newest first)' })
  @ApiOkResponse({ description: '{ data: CustomOrderSummary[], meta: { page, pageSize, total } }' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHENTICATED' })
  async list(@CurrentAuth() auth: AuthContext, @Query() q: MyOrdersQuery): Promise<Paginated<CustomOrderSummary>> {
    const { items, total } = await this.orders.listForUser(auth.user.id, q.page, q.pageSize);
    return new Paginated(items, { page: q.page, pageSize: q.pageSize, total });
  }

  @Post('claim')
  @HttpCode(200)
  @ApiOperation({ summary: 'Attach a guest order to my account (reference + the e-mail used to place it; needs x-csrf-token)' })
  @ApiNotFoundResponse({ description: 'ORDER_NOT_FOUND (unknown, wrong e-mail, or owned by someone else)' })
  claim(@CurrentAuth() auth: AuthContext, @Body() dto: ClaimOrderDto, @Req() req: Request & { id?: string }): Promise<CustomOrderView> {
    return this.orders.claim(auth.user.id, dto.reference, dto.email, { ipAddress: req.ip, requestId: req.id });
  }

  @Get(':reference')
  @ApiOperation({ summary: 'One of my orders, same payload as tracking (no e-mail needed)' })
  @ApiNotFoundResponse({ description: 'ORDER_NOT_FOUND' })
  detail(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string): Promise<CustomOrderView> {
    return this.orders.getForUser(auth.user.id, reference);
  }
}
