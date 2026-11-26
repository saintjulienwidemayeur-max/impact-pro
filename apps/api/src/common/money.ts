import { Prisma } from '@prisma/client';

/** Money is always serialised as a string with exactly 2 decimals (never a JS float). */
export function money(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}
