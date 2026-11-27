import { CustomOrderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageQuery } from '../../common/pagination';

export class ListOrdersQuery extends PageQuery {
  @IsOptional()
  @IsEnum(CustomOrderStatus)
  status?: CustomOrderStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  customerId?: string;
}

export class OrderStatusDto {
  @IsEnum(CustomOrderStatus)
  status!: CustomOrderStatus;

  /** Optional internal note stored next to the status change. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class OrderNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
