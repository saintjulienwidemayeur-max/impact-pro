import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '@prisma/client';
import type { AuthedRequest } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_PERMISSION } from './require-permission.decorator';

/**
 * Stand-in (billing agent): replaced by the admin core agent's version at merge.
 * Role → permissions matrix of docs/admin-contract.md §1.
 */
const ALL = [
  'dashboard.read', 'orders.read', 'orders.write', 'customers.read', 'customers.write', 'quotes.read', 'quotes.write',
  'invoices.read', 'invoices.write', 'payments.write', 'billing.settings', 'products.read', 'products.write', 'mail.read',
  'mail.send', 'users.manage', 'audit.read', 'reports.read',
] as const;
const MATRIX: Record<StaffRole, readonly string[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ALL,
  SALES: ['dashboard.read', 'orders.read', 'orders.write', 'customers.read', 'customers.write', 'quotes.read', 'quotes.write', 'invoices.read', 'products.read', 'mail.read', 'mail.send', 'reports.read'],
  ACCOUNTING: ['dashboard.read', 'orders.read', 'customers.read', 'quotes.read', 'invoices.read', 'invoices.write', 'payments.write', 'billing.settings', 'reports.read', 'mail.read', 'mail.send'],
  PRODUCTION: ['dashboard.read', 'orders.read', 'orders.write', 'products.read'],
  SUPPORT: ['dashboard.read', 'orders.read', 'customers.read', 'customers.write', 'mail.read', 'mail.send'],
};

export const permissionsFor = (role: StaffRole | null | undefined): readonly string[] => (role ? MATRIX[role] : []);

/** 401 without a session, 403 for non-staff or a missing permission. Use after `SessionGuard`. */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
    const user = await this.prisma.user.findUnique({ where: { id: req.auth.user.id }, select: { isStaff: true, staffRole: true, status: true } });
    if (!user?.isStaff || user.status !== 'ACTIVE' || !user.staffRole) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Staff access required' });
    const needed = this.reflector.getAllAndOverride<string | undefined>(REQUIRED_PERMISSION, [context.getHandler(), context.getClass()]);
    if (needed && !permissionsFor(user.staffRole).includes(needed)) throw new ForbiddenException({ code: 'FORBIDDEN', message: `Missing permission ${needed}` });
    return true;
  }
}
