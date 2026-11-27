import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value);

export class ListCustomersQuery extends PageQuery {}

export class CreateCustomerDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(160) company?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @Matches(/^[0-9+()\-.\s]{6,30}$/, { message: 'phone looks invalid' }) phone?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 2) country?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) taxId?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000) notes?: string | null;
}

export class UpdateCustomerDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) fullName?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(160) company?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @Matches(/^[0-9+()\-.\s]{6,30}$/, { message: 'phone looks invalid' }) phone?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 2) country?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) taxId?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000) notes?: string | null;
}
