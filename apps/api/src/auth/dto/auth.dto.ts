import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsOptional, IsString, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const email = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
/** "" and null clear an optional field. */
const emptyToNull = ({ value }: { value: unknown }) => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

const PHONE = /^\+?[0-9][0-9 -]*[0-9]$/;
const PHONE_MESSAGE = 'phone must contain only digits, spaces, dashes and an optional leading +';

export class RegisterDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Marie Joseph' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @ApiProperty({ example: 'marie@example.com' })
  @Transform(email)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: '+509 3712-3456', description: '8–20 characters: digits, spaces, dashes, optional leading +' })
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Length(8, 20)
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone?: string | null;

  @ApiProperty({ minLength: 10, maxLength: 128, description: 'Checked against a small list of common passwords' })
  @IsString()
  @MaxLength(512)
  password!: string;

  @ApiProperty({ example: true })
  @Equals(true, { message: 'acceptTerms must be true' })
  acceptTerms!: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'marie@example.com' })
  @Transform(email)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 512)
  password!: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiPropertyOptional({ nullable: true, description: 'null or "" removes the phone number' })
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Length(8, 20)
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone?: string | null;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 512)
  currentPassword!: string;

  @ApiProperty({ minLength: 10, maxLength: 128 })
  @IsString()
  @MaxLength(512)
  newPassword!: string;
}

export class ClaimOrderDto {
  @ApiProperty({ example: 'IP-2026-000042' })
  @Transform(trim)
  @IsString()
  @Matches(/^IP-\d{4}-\d{6}$/, { message: 'reference must look like IP-2026-000042' })
  reference!: string;

  @ApiProperty({ description: 'The e-mail used to place the order' })
  @Transform(email)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
