import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus, DocumentType, PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** JSON clients may send numbers: normalise to strings so decimals are never parsed as floats downstream. */
const numToString = ({ value }: { value: unknown }) => (typeof value === 'number' ? String(value) : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

const QTY = /^\d{1,9}(\.\d{1,3})?$/;
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const PERCENT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
const CURRENCIES = ['HTG', 'USD'] as const;

export class CustomerSnapshotDto {
  @ApiProperty({ example: 'Marie Joseph' })
  @Transform(trim)
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(160) company?: string | null;

  @ApiProperty({ example: 'marie@example.com' })
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(40) phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300) address?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120) city?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120) country?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) taxId?: string | null;
}

export class DocumentLineDto {
  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  description!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) sku?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) productId?: string | null;

  @ApiProperty({ example: '12', description: 'Up to 3 decimals' })
  @Transform(numToString)
  @IsString()
  @Matches(QTY, { message: 'quantity must be a positive number with at most 3 decimals' })
  quantity!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(20) unit?: string | null;

  @ApiProperty({ example: '650.00' })
  @Transform(numToString)
  @IsString()
  @Matches(MONEY, { message: 'unitPrice must be a non-negative amount with at most 2 decimals' })
  unitPrice!: string;

  @ApiPropertyOptional({ example: '10' })
  @IsOptional()
  @Transform(numToString)
  @IsString()
  @Matches(PERCENT, { message: 'discountPercent must be between 0 and 100' })
  discountPercent?: string;
}

class DocumentFieldsDto {
  @ApiPropertyOptional({ description: 'Customer directory id; the snapshot is copied from it when `customer` is omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  customerId?: string;

  @ApiPropertyOptional({ type: CustomerSnapshotDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerSnapshotDto)
  customer?: CustomerSnapshotDto;

  @ApiPropertyOptional({ enum: CURRENCIES })
  @IsOptional()
  @IsIn(CURRENCIES as unknown as string[])
  currency?: 'HTG' | 'USD';

  @ApiPropertyOptional({ example: '2026-11-27' }) @IsOptional() @IsISO8601({ strict: true }) issueDate?: string;
  @ApiPropertyOptional({ example: '2026-12-12' }) @IsOptional() @Transform(emptyToNull) @IsISO8601({ strict: true }) dueDate?: string | null;
  @ApiPropertyOptional({ example: '2026-12-27' }) @IsOptional() @Transform(emptyToNull) @IsISO8601({ strict: true }) validUntil?: string | null;

  @ApiPropertyOptional({ type: [DocumentLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines?: DocumentLineDto[];

  @ApiPropertyOptional({ example: '6' })
  @IsOptional()
  @Transform(numToString)
  @IsString()
  @Matches(PERCENT, { message: 'taxRate must be between 0 and 100' })
  taxRate?: string;

  @ApiPropertyOptional({ example: '100.00' })
  @IsOptional()
  @Transform(numToString)
  @IsString()
  @Matches(MONEY, { message: 'discountAmount must be a non-negative amount' })
  discountAmount?: string;

  @ApiPropertyOptional({ example: '350.00' })
  @IsOptional()
  @Transform(numToString)
  @IsString()
  @Matches(MONEY, { message: 'shippingAmount must be a non-negative amount' })
  shippingAmount?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(4000) notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(4000) internalNotes?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(6000) terms?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(4000) paymentInstructions?: string | null;
}

export class CreateDocumentDto extends DocumentFieldsDto {
  @ApiProperty({ enum: DocumentType }) @IsEnum(DocumentType) type!: DocumentType;
  @ApiPropertyOptional({ description: 'Prepare the document from this custom order (lines/customer/currency prefilled)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  orderId?: string;
}

export class UpdateDocumentDto extends DocumentFieldsDto {}

export class SendDocumentDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)) : value)) @IsEmail({}, { each: true }) to?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)) : value)) @IsEmail({}, { each: true }) cc?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)) : value)) @IsEmail({}, { each: true }) bcc?: string[];
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200) subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) message?: string;
  @ApiPropertyOptional({ description: 'Only record that the document was sent through another channel (e.g. WhatsApp)' })
  @IsOptional()
  @IsBoolean()
  markAsSentOnly?: boolean;
}

export class ConvertDocumentDto {
  @ApiProperty({ enum: ['PROFORMA', 'INVOICE'] }) @IsIn(['PROFORMA', 'INVOICE']) to!: 'PROFORMA' | 'INVOICE';
}

export class VoidDto {
  @ApiProperty({ minLength: 3, maxLength: 500 }) @Transform(trim) @IsString() @Length(3, 500) reason!: string;
}

export class SetStatusDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] }) @IsIn(['ACCEPTED', 'REJECTED']) status!: 'ACCEPTED' | 'REJECTED';
}

export class RecordPaymentDto {
  @ApiProperty({ example: '400.00' })
  @Transform(numToString)
  @IsString()
  @Matches(MONEY, { message: 'amount must be a positive amount with at most 2 decimals' })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method!: PaymentMethod;
  @ApiPropertyOptional({ example: '2026-11-27' }) @IsOptional() @IsISO8601({ strict: true }) paidAt?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120) reference?: string | null;
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(1000) notes?: string | null;
}

export class DocumentListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 25;
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(60) customerId?: string;
  @IsOptional() @IsString() @MaxLength(60) orderId?: string;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsIn(['true', 'false']) overdue?: 'true' | 'false';
  @IsOptional() @IsIn(['createdAt:desc', 'createdAt:asc', 'issueDate:desc', 'issueDate:asc', 'total:desc', 'total:asc', 'number:desc', 'number:asc'])
  sort: string = 'createdAt:desc';
}

export class ExportQuery {
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}

export class RevenueQuery {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsIn(['day', 'month']) groupBy: 'day' | 'month' = 'month';
}

const PREFIX = /^[A-Z0-9]{2,6}$/;

export class PrefixesDto {
  @ApiProperty({ example: 'DEV' }) @Matches(PREFIX, { message: 'prefix must be 2–6 uppercase letters or digits' }) quote!: string;
  @ApiProperty({ example: 'PRO' }) @Matches(PREFIX, { message: 'prefix must be 2–6 uppercase letters or digits' }) proforma!: string;
  @ApiProperty({ example: 'FAC' }) @Matches(PREFIX, { message: 'prefix must be 2–6 uppercase letters or digits' }) invoice!: string;
}

export class BillingSettingsDto {
  @Transform(trim) @IsString() @Length(2, 160) legalName!: string;
  @Transform(trim) @IsString() @Length(1, 300) address!: string;
  @Transform(trim) @IsString() @Length(1, 120) city!: string;
  @Transform(trim) @IsString() @Length(1, 120) country!: string;
  @Transform(trim) @IsString() @Length(1, 40) phone!: string;
  @Transform(trim) @IsString() @Length(3, 254) email!: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(200) website?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) taxId?: string | null;
  @IsIn(CURRENCIES as unknown as string[]) defaultCurrency!: 'HTG' | 'USD';
  @Transform(numToString) @IsString() @Matches(PERCENT, { message: 'defaultTaxRate must be between 0 and 100' }) defaultTaxRate!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(365) paymentTermsDays!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(365) quoteValidityDays!: number;
  @ValidateNested() @Type(() => PrefixesDto) prefixes!: PrefixesDto;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(4000) bankDetails?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(4000) paymentInstructions?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(6000) defaultTerms?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(1000) footerNote?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500) logoUrl?: string | null;
}
