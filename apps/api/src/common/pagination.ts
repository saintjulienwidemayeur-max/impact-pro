import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** Common list query of the admin API: `?page=1&pageSize=25&sort=createdAt:desc&q=…`. */
export class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_]*(:(asc|desc))?$/, { message: 'sort must look like "createdAt:desc"' })
  sort?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export const skipTake = (q: Pick<PageQuery, 'page' | 'pageSize'>): { skip: number; take: number } => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});

export const pageMeta = (q: Pick<PageQuery, 'page' | 'pageSize'>, total: number) => ({
  page: q.page,
  pageSize: q.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
});

/**
 * Turns `?sort=field:dir` into a Prisma orderBy, restricted to an allow-list (unknown fields fall back to the default).
 * `fields` maps the public name to a function building the orderBy for a direction.
 */
export function parseSort<T>(
  sort: string | undefined,
  fields: Record<string, (dir: 'asc' | 'desc') => T>,
  fallback: T,
): T {
  if (!sort) return fallback;
  const [name, dirRaw] = sort.split(':');
  const build = fields[name];
  if (!build) return fallback;
  return build(dirRaw === 'asc' ? 'asc' : 'desc');
}
