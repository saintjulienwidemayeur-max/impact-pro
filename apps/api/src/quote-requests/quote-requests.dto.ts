import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteRequestService, QuoteRequestStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { PageQuery } from '../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Optional text: trims and turns "" into undefined so empty form fields are accepted. */
const trimOptional = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value);

export const PROJECT_SIZES = ['petit', 'moyen', 'grand'] as const;

/** Storefront service ids → enum (the public form uses short French ids). */
export const SERVICE_FROM_FORM: Record<string, QuoteRequestService> = {
  articles: QuoteRequestService.ARTICLES,
  sourcing: QuoteRequestService.SOURCING,
  evenement: QuoteRequestService.EVENT,
  conseil: QuoteRequestService.CONSULTING,
};

export class CreateQuoteRequestDto {
  @ApiProperty({ enum: Object.keys(SERVICE_FROM_FORM), example: 'articles' })
  @IsIn(Object.keys(SERVICE_FROM_FORM), { message: 'service must be one of articles, sourcing, evenement, conseil' })
  service!: string;

  @ApiPropertyOptional({ enum: PROJECT_SIZES })
  @Transform(trimOptional)
  @IsOptional()
  @IsIn(PROJECT_SIZES)
  size?: (typeof PROJECT_SIZES)[number];

  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Marie Joseph' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiProperty({ example: '+509 3712-3456' })
  @Transform(trim)
  @IsString()
  @Length(8, 20)
  @Matches(/^\+?[0-9][0-9 -]*[0-9]$/, { message: 'phone must contain only digits, spaces, dashes and an optional leading +' })
  phone!: string;

  @ApiProperty({ example: 'marie@example.com' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 2, maxLength: 2000, description: 'What the customer needs (products, event, item to source…)' })
  @Transform(trim)
  @IsString()
  @Length(2, 2000)
  products!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1_000_000 })
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (raw === '' || raw === null || raw === undefined) return undefined;
    return typeof raw === 'string' ? Number(raw) : raw;
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @ApiPropertyOptional({ maxLength: 4000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Logo previously uploaded with POST /uploads/logos' })
  @Transform(trimOptional)
  @IsOptional()
  @IsUUID()
  logoUploadId?: string;
}

export class ListQuoteRequestsQuery extends PageQuery {
  @ApiPropertyOptional({ enum: QuoteRequestStatus })
  @IsOptional()
  @IsEnum(QuoteRequestStatus)
  status?: QuoteRequestStatus;

  @ApiPropertyOptional({ enum: QuoteRequestService })
  @IsOptional()
  @IsEnum(QuoteRequestService)
  service?: QuoteRequestService;
}

export class UpdateQuoteRequestDto {
  @ApiPropertyOptional({ enum: QuoteRequestStatus })
  @IsOptional()
  @IsEnum(QuoteRequestStatus)
  status?: QuoteRequestStatus;

  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(4000)
  internalNote?: string | null;
}
