import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMethod, PrintPlacement } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Optional text: trims and turns "" into undefined so empty form fields are accepted. */
const trimOptional = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

export class CustomerDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Marie Joseph' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiProperty({ example: '+509 3712-3456', description: '8–20 characters: digits, spaces, dashes, optional leading +' })
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

  @ApiPropertyOptional({ maxLength: 120, example: 'Port-au-Prince' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class CustomOrderItemDto {
  @ApiProperty({ example: 'tasse-ceramique-11oz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/)
  productSlug!: string;

  @ApiProperty({ minimum: 1, maximum: 100000, description: 'Must also be ≥ the product minQty' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @ApiPropertyOptional({ maxLength: 40 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @ApiProperty({ enum: PrintPlacement })
  @IsEnum(PrintPlacement)
  placement!: PrintPlacement;

  @ApiProperty({ format: 'uuid', description: 'id returned by POST /api/v1/uploads/logos (valid for 7 days)' })
  @IsUUID()
  logoUploadId!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Accepted for client convenience but IGNORED — prices are always computed server-side. */
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored. Prices are computed by the server.' })
  @Allow()
  unitPrice?: unknown;

  /** Accepted but IGNORED. */
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored. Prices are computed by the server.' })
  @Allow()
  lineTotal?: unknown;
}

export class CreateCustomOrderDto {
  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: [CustomOrderItemDto], minItems: 1, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CustomOrderItemDto)
  items!: CustomOrderItemDto[];

  @ApiProperty({ enum: DeliveryMethod })
  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Accepted but IGNORED — the server computes the subtotal. */
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored. Computed by the server.' })
  @Allow()
  subtotal?: unknown;
}

export class TrackCustomOrderQuery {
  @ApiProperty({ description: 'Email used when placing the order' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
