import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiConflictResponse, ApiCookieAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthContext, AuthedRequest } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/current-auth.decorator';
import { OriginGuard } from '../../auth/guards';
import { Paginated } from '../../common/response.interceptor';
import { actorOf } from '../admin-context';
import { RequirePermission, StaffGuard } from '../staff.guard';
import { ListOrdersQuery, OrderNoteDto, OrderStatusDto } from './admin-orders.dto';
import { AdminOrdersService, type OrderDetail, type OrderEventView, type OrderListItem } from './admin-orders.service';

@ApiTags('admin · orders')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/orders', version: '1' })
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @RequirePermission('orders.read')
  @ApiOperation({ summary: 'Orders: filter by status / dates / customer, search by reference, name, company, e-mail, phone' })
  async list(@Query() q: ListOrdersQuery): Promise<Paginated<OrderListItem>> {
    const { items, meta } = await this.orders.list(q);
    return new Paginated(items, meta);
  }

  @Get(':id')
  @RequirePermission('orders.read')
  @ApiOperation({ summary: 'Order detail: items with design elements, uploads and mock-ups, customer, documents, timeline' })
  @ApiNotFoundResponse({ description: 'ORDER_NOT_FOUND' })
  detail(@Param('id') id: string): Promise<OrderDetail> {
    return this.orders.detail(id);
  }

  @Get(':id/events')
  @RequirePermission('orders.read')
  @ApiOperation({ summary: 'Order timeline (status changes, notes, documents, e-mails)' })
  events(@Param('id') id: string): Promise<OrderEventView[]> {
    return this.orders.events(id);
  }

  @Patch(':id/status')
  @RequirePermission('orders.write')
  @ApiOperation({ summary: 'Change the status (forward, or cancel; reopen = admins only) and log it in the timeline' })
  @ApiConflictResponse({ description: 'INVALID_TRANSITION' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN (reopen needs ADMIN / SUPER_ADMIN)' })
  setStatus(@Param('id') id: string, @Body() dto: OrderStatusDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<OrderDetail> {
    return this.orders.setStatus(id, dto, actorOf(req, auth));
  }

  @Post(':id/notes')
  @HttpCode(201)
  @RequirePermission('orders.write')
  @ApiOperation({ summary: 'Add an internal note to the timeline' })
  addNote(@Param('id') id: string, @Body() dto: OrderNoteDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<OrderEventView> {
    return this.orders.addNote(id, dto, actorOf(req, auth));
  }
}
