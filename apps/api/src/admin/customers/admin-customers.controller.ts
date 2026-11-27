import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiConflictResponse, ApiCookieAuth, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthContext, AuthedRequest } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/current-auth.decorator';
import { OriginGuard } from '../../auth/guards';
import { Paginated } from '../../common/response.interceptor';
import { actorOf } from '../admin-context';
import { RequirePermission, StaffGuard } from '../staff.guard';
import { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './admin-customers.dto';
import { AdminCustomersService, type CustomerDetail, type CustomerListItem } from './admin-customers.service';

@ApiTags('admin · customers')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/customers', version: '1' })
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  @RequirePermission('customers.read')
  @ApiOperation({ summary: 'Customer directory (search by e-mail, name, company, phone) with order counts and balances' })
  async list(@Query() q: ListCustomersQuery): Promise<Paginated<CustomerListItem>> {
    const { items, meta } = await this.customers.list(q);
    return new Paginated(items, meta);
  }

  @Get(':id')
  @RequirePermission('customers.read')
  @ApiOperation({ summary: 'Customer detail with orders and documents' })
  @ApiNotFoundResponse({ description: 'CUSTOMER_NOT_FOUND' })
  detail(@Param('id') id: string): Promise<CustomerDetail> {
    return this.customers.detail(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('customers.write')
  @ApiOperation({ summary: 'Create a customer by hand' })
  @ApiConflictResponse({ description: 'CONFLICT (e-mail already in the directory)' })
  create(@Body() dto: CreateCustomerDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<CustomerDetail> {
    return this.customers.create(dto, actorOf(req, auth));
  }

  @Patch(':id')
  @RequirePermission('customers.write')
  @ApiOperation({ summary: 'Edit a customer (e-mail is the identity and cannot be changed)' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<CustomerDetail> {
    return this.customers.update(id, dto, actorOf(req, auth));
  }
}
