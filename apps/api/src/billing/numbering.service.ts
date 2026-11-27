import { Injectable } from '@nestjs/common';
import type { DocumentType, Prisma } from '@prisma/client';

/**
 * Gap-free yearly document numbers (`FAC-2026-0001`). The counter row is locked with `SELECT … FOR UPDATE`
 * inside the caller's transaction, so concurrent creations get distinct, consecutive numbers and a rolled-back
 * creation never burns a number. Voided documents keep theirs (they are never deleted), so numbers are not reused.
 */
@Injectable()
export class NumberingService {
  async allocate(tx: Prisma.TransactionClient, type: DocumentType, prefix: string, now = new Date()): Promise<string> {
    const year = now.getUTCFullYear();
    await tx.$executeRaw`INSERT INTO "DocumentCounter" ("type", "year", "last") VALUES (${type}::"DocumentType", ${year}, 0) ON CONFLICT ("type", "year") DO NOTHING`;
    const rows = await tx.$queryRaw<{ last: number }[]>`SELECT "last" FROM "DocumentCounter" WHERE "type" = ${type}::"DocumentType" AND "year" = ${year} FOR UPDATE`;
    const next = (rows[0]?.last ?? 0) + 1;
    await tx.$executeRaw`UPDATE "DocumentCounter" SET "last" = ${next} WHERE "type" = ${type}::"DocumentType" AND "year" = ${year}`;
    return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
  }

  /**
   * Deleting a DRAFT: when it holds the latest number of its year the counter steps back so no gap is left;
   * otherwise (a newer document already exists) the gap is unavoidable and is documented by the audit log.
   */
  async release(tx: Prisma.TransactionClient, type: DocumentType, number: string): Promise<void> {
    const m = /-(\d{4})-(\d+)$/.exec(number);
    if (!m) return;
    const year = Number(m[1]);
    const seq = Number(m[2]);
    const rows = await tx.$queryRaw<{ last: number }[]>`SELECT "last" FROM "DocumentCounter" WHERE "type" = ${type}::"DocumentType" AND "year" = ${year} FOR UPDATE`;
    if (rows[0] && rows[0].last === seq) {
      await tx.$executeRaw`UPDATE "DocumentCounter" SET "last" = ${seq - 1} WHERE "type" = ${type}::"DocumentType" AND "year" = ${year}`;
    }
  }
}
