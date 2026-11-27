import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export interface CustomerContact {
  email: string;
  fullName: string;
  company?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}

/**
 * Customer directory used by the back-office. Rows are matched by lower-cased e-mail and created automatically from
 * orders and account sign-ups. Automatic updates only FILL EMPTY fields: edits made by staff are never overwritten.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds or creates the customer of an order (called inside the order transaction). Returns its id. */
  async upsertFromOrder(c: CustomerContact, userId: string | null | undefined, db: Db = this.prisma): Promise<string> {
    const email = c.email.trim().toLowerCase();
    const existing = await db.customer.findUnique({ where: { email } });
    if (!existing) {
      const created = await db.customer
        .create({
          data: {
            email,
            fullName: c.fullName,
            company: c.company ?? null,
            phone: c.phone ?? null,
            address: c.address ?? null,
            city: c.city ?? null,
            source: 'ORDER',
            userId: userId ?? undefined,
          },
        })
        .catch((e: unknown) => {
          // A concurrent order for the same e-mail created it first, or the account is already linked to another row.
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
          throw e;
        });
      if (created) return created.id;
      return (await db.customer.findUniqueOrThrow({ where: { email } })).id;
    }
    const patch: Prisma.CustomerUpdateInput = {};
    if (!existing.company && c.company) patch.company = c.company;
    if (!existing.phone && c.phone) patch.phone = c.phone;
    if (!existing.address && c.address) patch.address = c.address;
    if (!existing.city && c.city) patch.city = c.city;
    if (!existing.userId && userId) {
      const taken = await db.customer.findUnique({ where: { userId }, select: { id: true } });
      if (!taken) patch.user = { connect: { id: userId } };
    }
    if (Object.keys(patch).length) await db.customer.update({ where: { id: existing.id }, data: patch });
    return existing.id;
  }

  /** Called after a customer account is created: links an existing directory row (from orders) or creates one. */
  async upsertFromAccount(user: Pick<User, 'id' | 'email' | 'fullName' | 'phone'>, db: Db = this.prisma): Promise<string> {
    const email = user.email.trim().toLowerCase();
    const existing = await db.customer.findUnique({ where: { email } });
    if (existing) {
      if (!existing.userId) await db.customer.update({ where: { id: existing.id }, data: { user: { connect: { id: user.id } } } });
      return existing.id;
    }
    const created = await db.customer.create({
      data: { email, fullName: user.fullName ?? email.split('@')[0], phone: user.phone ?? null, source: 'ACCOUNT', userId: user.id },
    });
    return created.id;
  }
}
