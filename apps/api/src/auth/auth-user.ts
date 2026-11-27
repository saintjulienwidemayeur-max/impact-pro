import type { User } from '@prisma/client';
import { permissionsFor } from '../admin/rbac';
import type { AuthUser } from './auth.types';

/** Public view of a user row. Staff additionally expose their role, permissions and the password-change flag. */
export const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || null),
  phone: u.phone,
  role: u.isStaff ? 'STAFF' : 'CUSTOMER',
  emailVerified: Boolean(u.emailVerified),
  createdAt: u.createdAt.toISOString(),
  ...(u.isStaff && {
    isStaff: true as const,
    staffRole: u.staffRole,
    permissions: permissionsFor(u.staffRole),
    mustChangePassword: u.mustChangePassword,
  }),
});
