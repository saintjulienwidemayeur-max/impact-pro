import { PricingMode, PrintPlacement, ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value);
const strings = ({ value }: { value: unknown }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value);

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

export class ListProductsQuery extends PageQuery {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class PriceTierDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  minQty!: number;

  @Matches(MONEY, { message: 'unitPrice must be a decimal with at most 2 digits' })
  unitPrice!: string;
}

class ProductFieldsDto {
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @Matches(MONEY, { message: 'compareAtPrice must be a decimal with at most 2 digits' }) compareAtPrice?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) minQty?: number;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) unitLabel?: string;
  @IsOptional() @Transform(strings) @IsArray() @ArrayMaxSize(40) @ArrayUnique() @IsString({ each: true }) @MaxLength(60, { each: true }) colors?: string[];
  @IsOptional() @Transform(strings) @IsArray() @ArrayMaxSize(80) @ArrayUnique() @IsString({ each: true }) @MaxLength(60, { each: true }) sizes?: string[];
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) colorLabel?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) sizeLabel?: string;
  @IsOptional() @IsBoolean() colorsRequired?: boolean;
  @IsOptional() @IsBoolean() sizesRequired?: boolean;
  @IsOptional() @IsArray() @ArrayUnique() @IsEnum(PrintPlacement, { each: true }) placements?: PrintPlacement[];
  @IsOptional() @IsEnum(PricingMode) pricingMode?: PricingMode;
  @IsOptional() @IsBoolean() supportsLogo?: boolean;
  @IsOptional() @IsBoolean() supportsText?: boolean;
  @IsOptional() @IsBoolean() supportsArtwork?: boolean;
  @IsOptional() @IsBoolean() artworkRequired?: boolean;
  /** { minWidthCm, maxWidthCm, minHeightCm, maxHeightCm, defaultWidthCm, defaultHeightCm, minBillableM2 } or null. */
  @IsOptional() @IsObject() customSize?: Record<string, number> | null;
  /** Replaces the whole list when present. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PriceTierDto) priceTiers?: PriceTierDto[];
}

export class UpdateProductDto extends ProductFieldsDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @Matches(MONEY, { message: 'basePrice must be a decimal with at most 2 digits' }) basePrice?: string;
}

export class CreateProductDto extends ProductFieldsDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug must be lower-case kebab-case' })
  @MaxLength(80)
  slug!: string;

  @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) name!: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) categorySlug?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) categoryId?: string;

  @Matches(MONEY, { message: 'basePrice must be a decimal with at most 2 digits' })
  basePrice!: string;
}
