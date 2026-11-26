import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionService } from '../auth/session.service';
import { orderThrottle } from '../common/throttle-limits';
import { CustomOrdersService, type CustomOrderView } from './custom-orders.service';
import { CreateCustomOrderDto, TrackCustomOrderQuery } from './dto/create-custom-order.dto';

@ApiTags('custom-orders')
@Controller({ path: 'custom-orders', version: '1' })
export class CustomOrdersController {
  constructor(
    private readonly orders: CustomOrdersService,
    private readonly sessions: SessionService,
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle(orderThrottle)
  @ApiOperation({
    summary: 'Place a customized order from the storefront',
    description: 'Prices are computed server-side from catalog price tiers; any client-sent price is ignored.',
  })
  @ApiCreatedResponse({ description: '{ data: { reference, status, currency, subtotal, items[], createdAt } }' })
  @ApiUnprocessableEntityResponse({
    description:
      'VALIDATION_ERROR · QUANTITY_BELOW_MINIMUM · UPLOAD_NOT_FOUND · ELEMENT_NOT_SUPPORTED · ARTWORK_REQUIRED · SIZE_OUT_OF_RANGE',
  })
  @ApiNotFoundResponse({ description: 'PRODUCT_NOT_FOUND' })
  @ApiTooManyRequestsResponse({ description: 'Rate limited' })
  async create(@Body() dto: CreateCustomOrderDto, @Req() req: Request & { id?: string }): Promise<CustomOrderView> {
    // Guests keep ordering as before. The order is attached to an account only when the session cookie AND the CSRF header are valid.
    const auth = await this.sessions.userForRequest(req);
    return this.orders.create(dto, { ipAddress: req.ip, requestId: req.id, userId: auth?.user.id });
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Track an order by reference; requires the email used to place it' })
  @ApiOkResponse({ description: 'Same payload as creation' })
  @ApiNotFoundResponse({ description: 'ORDER_NOT_FOUND (also when the email does not match)' })
  track(@Param('reference') reference: string, @Query() query: TrackCustomOrderQuery): Promise<CustomOrderView> {
    return this.orders.track(reference, query.email);
  }
}
