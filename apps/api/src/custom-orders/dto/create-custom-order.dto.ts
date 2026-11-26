import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMethod, ElementKind, PrintPlacement } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TEXT_FONTS } from '../../catalog/placements';

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

/** Text content: normalises newlines, drops control characters, trims. */
const cleanText = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .replace(/\r\n?/g, '\n')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
        .trim()
    : value;

/** One design element (logo, text or ready-to-print artwork) placed in a print zone. */
export class DesignElementDto {
  @ApiProperty({ enum: PrintPlacement, description: 'Must be one of the product placements' })
  @IsEnum(PrintPlacement)
  placement!: PrintPlacement;

  @ApiProperty({ enum: ElementKind })
  @IsEnum(ElementKind)
  kind!: ElementKind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for LOGO and ARTWORK; id from POST /uploads/logos or /uploads/artwork (valid 7 days)' })
  @ValidateIf((o: DesignElementDto) => o.kind === ElementKind.LOGO || o.kind === ElementKind.ARTWORK)
  @IsUUID()
  uploadId?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 200, description: 'Required for TEXT; max 6 lines' })
  @ValidateIf((o: DesignElementDto) => o.kind === ElementKind.TEXT)
  @Transform(cleanText)
  @IsString()
  @Length(1, 200)
  @Matches(/^[^\n]*(\n[^\n]*){0,5}$/, { message: 'text must have at most 6 lines' })
  text?: string;

  @ApiPropertyOptional({ enum: TEXT_FONTS, default: 'inter' })
  @IsOptional()
  @IsIn(TEXT_FONTS as unknown as string[])
  font?: string;

  @ApiPropertyOptional({ enum: ['regular', 'bold'], default: 'regular' })
  @IsOptional()
  @IsIn(['regular', 'bold'])
  fontWeight?: 'regular' | 'bold';

  @ApiPropertyOptional({ example: '#0A716A', default: '#000000' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be #RRGGBB' })
  color?: string;

  @ApiPropertyOptional({ enum: ['left', 'center', 'right'], default: 'center' })
  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  align?: 'left' | 'center' | 'right';

  @ApiPropertyOptional({ minimum: -0.5, maximum: 0.5, default: 0, description: 'Horizontal offset of the element center, fraction of the print-area width' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-0.5)
  @Max(0.5)
  x?: number;

  @ApiPropertyOptional({ minimum: -0.5, maximum: 0.5, default: 0, description: 'Vertical offset, fraction of the print-area height' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-0.5)
  @Max(0.5)
  y?: number;

  @ApiPropertyOptional({ minimum: 0.05, maximum: 4, default: 1, description: '1 = contain-fit inside the print area' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.05)
  @Max(4)
  scale?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, default: 0, description: 'Degrees' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  rotation?: number;

  @ApiPropertyOptional({ description: 'Layer order; assigned from the array order when absent' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sort?: number;
}

/** Rendered mock-up of one print zone (id from POST /uploads/previews). */
export class ItemPreviewDto {
  @ApiProperty({ enum: PrintPlacement, description: 'Must be one of the product placements; at most one preview per zone' })
  @IsEnum(PrintPlacement)
  placement!: PrintPlacement;

  @ApiProperty({ format: 'uuid', description: 'Id returned by POST /uploads/previews (valid 7 days)' })
  @IsUUID()
  uploadId!: string;
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

  @ApiPropertyOptional({ maxLength: 40, description: 'One of product.colors (label: product.colorLabel); required when product.colorsRequired' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ maxLength: 60, description: 'One of product.sizes (label: product.sizeLabel); required when product.sizesRequired' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  size?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 2000, description: 'Required when the product has customSize (banners, tents…)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(2000)
  widthCm?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(2000)
  heightCm?: number;

  @ApiPropertyOptional({ type: [DesignElementDto], minItems: 1, maxItems: 30, description: 'Design elements; required unless the legacy placement + logoUploadId shorthand is used' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DesignElementDto)
  elements?: DesignElementDto[];

  @ApiPropertyOptional({ type: [ItemPreviewDto], maxItems: 12, description: 'Rendered mock-ups per zone so staff see what the customer saw (best effort, optional)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ItemPreviewDto)
  previews?: ItemPreviewDto[];

  @ApiPropertyOptional({ enum: PrintPlacement, deprecated: true, description: 'Legacy shorthand (with logoUploadId) for one centered LOGO element' })
  @IsOptional()
  @IsEnum(PrintPlacement)
  placement?: PrintPlacement;

  @ApiPropertyOptional({ format: 'uuid', deprecated: true, description: 'Legacy shorthand: id returned by POST /uploads/logos' })
  @IsOptional()
  @IsUUID()
  logoUploadId?: string;

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
