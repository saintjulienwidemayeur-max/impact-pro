import type { StaffRole } from '@prisma/client';
import type { AuthContext, AuthedRequest } from '../auth/auth.types';
import type { ActorContext } from '../common/audit.service';

/** The staff member behind an admin request (id for audit rows, role for business rules). */
export interface AdminActor extends ActorContext {
  actorId: string;
  staffRole: StaffRole;
  name: string;
}

export const actorOf = (req: AuthedRequest, auth: AuthContext): AdminActor => ({
  actorId: auth.user.id,
  staffRole: auth.user.staffRole as StaffRole,
  name: auth.user.fullName ?? auth.user.email,
  ipAddress: req.ip,
  requestId: req.id,
});

/** `{ id, name }` view of a user row, as used by events and audit entries. */
export const personOf = (u: { id: string; fullName: string | null; firstName: string | null; lastName: string | null; email: string } | null) =>
  u ? { id: u.id, name: u.fullName ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email) } : null;

export const PERSON_SELECT = { id: true, fullName: true, firstName: true, lastName: true, email: true } as const;
