import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiConflictResponse, ApiCookieAuth, ApiNotFoundResponse, ApiOperation, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { AuthContext, AuthedRequest } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/current-auth.decorator';
import { OriginGuard } from '../../auth/guards';
import { Paginated } from '../../common/response.interceptor';
import { actorOf } from '../admin-context';
import { RequirePermission, StaffGuard } from '../staff.guard';
import { CreateProductDto, ListProductsQuery, UpdateProductDto } from './admin-products.dto';
import { AdminProductsService, type AdminProduct } from './admin-products.service';

@ApiTags('admin · products')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/products', version: '1' })
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  @RequirePermission('products.read')
  @ApiOperation({ summary: 'All products (any status) with prices and options' })
  async list(@Query() q: ListProductsQuery): Promise<Paginated<AdminProduct>> {
    const { items, meta } = await this.products.list(q);
    return new Paginated(items, meta);
  }

  @Get(':id')
  @RequirePermission('products.read')
  @ApiNotFoundResponse({ description: 'PRODUCT_NOT_FOUND' })
  detail(@Param('id') id: string): Promise<AdminProduct> {
    return this.products.detail(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('products.write')
  @ApiOperation({ summary: 'Create a product (DRAFT by default) with its standard variant and optional price tiers' })
  @ApiConflictResponse({ description: 'CONFLICT (slug taken)' })
  create(@Body() dto: CreateProductDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<AdminProduct> {
    return this.products.create(dto, actorOf(req, auth));
  }

  @Patch(':id')
  @RequirePermission('products.write')
  @ApiOperation({ summary: 'Edit any subset of fields; `priceTiers`, when present, replaces the whole list' })
  @ApiUnprocessableEntityResponse({ description: 'VALIDATION_ERROR (tiers must be strictly ascending, prices > 0)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<AdminProduct> {
    return this.products.update(id, dto, actorOf(req, auth));
  }
}
