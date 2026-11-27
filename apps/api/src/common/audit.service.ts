import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Who / where an action comes from; built once per request by the controllers. */
export interface ActorContext {
  actorId: string | null;
  ipAddress?: string;
  requestId?: string;
}

export interface AuditEntryInput {
  action: string; // e.g. "order.status_change"
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
}

/** Append-only audit trail for back-office mutations. Never put secrets (passwords, tokens) in `metadata`. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(ctx: ActorContext, entry: AuditEntryInput, db: Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        actorId: ctx.actorId,
        metadata: entry.metadata,
        ipAddress: ctx.ipAddress ?? null,
        requestId: ctx.requestId ?? null,
      },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
