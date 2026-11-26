import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Paginated } from '../common/response.interceptor';
import { CatalogService, type CatalogProductView } from './catalog.service';

export class ListProductsQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 24;

  @ApiPropertyOptional({ description: 'Category slug, e.g. "tasses"' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ description: 'Free-text search on name, description and category' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

@ApiTags('catalog')
@Controller({ path: 'catalog/products', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List active products (paginated; filter by category, search with q)' })
  @ApiOkResponse({ description: '{ data: CatalogProduct[], meta: { page, pageSize, total } }' })
  async list(@Query() query: ListProductsQuery): Promise<Paginated<CatalogProductView>> {
    const q = query.q?.trim() || undefined;
    const { items, total } = await this.catalog.list({ ...query, q });
    return new Paginated(items, { page: query.page, pageSize: query.pageSize, total });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get one active product by slug, with price tiers and options' })
  @ApiNotFoundResponse({ description: 'PRODUCT_NOT_FOUND' })
  get(@Param('slug') slug: string): Promise<CatalogProductView> {
    return this.catalog.getBySlug(slug);
  }
}
