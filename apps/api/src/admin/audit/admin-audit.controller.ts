import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { OriginGuard } from '../../auth/guards';
import { PageQuery, pageMeta, skipTake } from '../../common/pagination';
import { Paginated } from '../../common/response.interceptor';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { PERSON_SELECT, personOf } from '../admin-context';
import { RequirePermission, StaffGuard } from '../staff.guard';

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  actor: { id: string; name: string } | null;
  ipAddress: string | null;
  createdAt: string;
}

class ListAuditQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(60) actorId?: string;
  /** Exact action (`order.status_change`) or a prefix ending with `*` (`order.*`). */
  @IsOptional() @IsString() @MaxLength(80) action?: string;
  @IsOptional() @IsString() @MaxLength(60) entityType?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export const auditInclude = { actor: { select: PERSON_SELECT } } satisfies Prisma.AuditLogInclude;
export const toAuditEntry = (a: Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>): AuditEntry => ({
  id: a.id,
  action: a.action,
  entityType: a.entityType,
  entityId: a.entityId,
  metadata: a.metadata ?? null,
  actor: personOf(a.actor),
  ipAddress: a.ipAddress,
  createdAt: a.createdAt.toISOString(),
});

@ApiTags('admin · audit')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/audit-logs', version: '1' })
export class AdminAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('audit.read')
  @ApiOperation({ summary: 'Audit trail (newest first), filter by actor, action, entity type and dates' })
  async list(@Query() q: ListAuditQuery): Promise<Paginated<AuditEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.actorId && { actorId: q.actorId }),
      ...(q.entityType && { entityType: q.entityType }),
      ...(q.action && (q.action.endsWith('*') ? { action: { startsWith: q.action.slice(0, -1) } } : { action: q.action })),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(/^\d{4}-\d{2}-\d{2}$/.test(q.to) ? `${q.to}T23:59:59.999Z` : q.to) }) } }),
      ...(q.q && { OR: [{ action: { contains: q.q, mode: 'insensitive' } }, { entityId: { contains: q.q } }] }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, include: auditInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...skipTake(q) }),
    ]);
    return new Paginated(rows.map(toAuditEntry), pageMeta(q, total));
  }
}
