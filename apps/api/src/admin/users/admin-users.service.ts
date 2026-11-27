import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StaffRole, UserStatus } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PasswordService, checkPasswordPolicy } from '../../auth/password.service';
import { SessionService } from '../../auth/session.service';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminActor } from '../admin-context';
import type { CreateStaffDto, UpdateStaffDto } from './admin-users.dto';

export interface StaffUser {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: StaffRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

const ALPHABET = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digit: '23456789',
  symbol: '#$%&*+-=?@',
};

/** 16 random characters with at least one upper, lower, digit and symbol; guaranteed to pass the password policy. */
export function generateTemporaryPassword(): string {
  const pick = (set: string) => set[randomInt(set.length)];
  for (;;) {
    const all = Object.values(ALPHABET).join('');
    const chars = [pick(ALPHABET.upper), pick(ALPHABET.lower), pick(ALPHABET.digit), pick(ALPHABET.symbol)];
    while (chars.length < 16) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const password = chars.join('');
    if (checkPasswordPolicy(password).length === 0) return password;
  }
}

type StaffRow = Prisma.UserGetPayload<Record<string, never>>;
const toStaff = (u: StaffRow): StaffUser => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || null),
  staffRole: u.staffRole as StaffRole,
  status: u.status,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

const notFound = () => new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Staff user not found' });
const forbidden = (message: string) => new ForbiddenException({ code: 'FORBIDDEN', message });
const conflict = (code: string, message: string) => new ConflictException({ code, message });

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<StaffUser[]> {
    const rows = await this.prisma.user.findMany({ where: { isStaff: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(toStaff);
  }

  /** Creates a staff account with a server-generated temporary password (returned once, never stored in clear). */
  async create(dto: CreateStaffDto, actor: AdminActor): Promise<StaffUser & { temporaryPassword: string }> {
    if (dto.staffRole === 'SUPER_ADMIN' && actor.staffRole !== 'SUPER_ADMIN') throw forbidden('Only a SUPER_ADMIN can create a SUPER_ADMIN');
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.passwords.hash(temporaryPassword);
    try {
      const u = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: dto.email, fullName: dto.fullName, isStaff: true, staffRole: dto.staffRole, passwordHash, mustChangePassword: true },
        });
        await this.audit.record(actor, { action: 'staff.create', entityType: 'User', entityId: created.id, metadata: { email: created.email, staffRole: dto.staffRole } }, tx);
        return created;
      });
      return { ...toStaff(u), temporaryPassword };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('EMAIL_TAKEN', 'An account already exists with this e-mail');
      throw e;
    }
  }

  private async loadTarget(id: string): Promise<StaffRow> {
    const u = await this.prisma.user.findFirst({ where: { id, isStaff: true } });
    if (!u) throw notFound();
    return u;
  }

  /** Number of ACTIVE SUPER_ADMINs other than `excludeId`. */
  private otherActiveSuperAdmins(excludeId: string): Promise<number> {
    return this.prisma.user.count({ where: { isStaff: true, staffRole: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: excludeId } } });
  }

  async update(id: string, dto: UpdateStaffDto, actor: AdminActor): Promise<StaffUser> {
    const target = await this.loadTarget(id);
    const isSelf = target.id === actor.actorId;
    const targetIsSuper = target.staffRole === 'SUPER_ADMIN';

    // Only a SUPER_ADMIN touches SUPER_ADMIN accounts or grants the role.
    if ((targetIsSuper || dto.staffRole === 'SUPER_ADMIN') && actor.staffRole !== 'SUPER_ADMIN') {
      throw forbidden('Only a SUPER_ADMIN can modify a SUPER_ADMIN account or grant that role');
    }
    if (isSelf && dto.staffRole !== undefined && dto.staffRole !== target.staffRole) throw conflict('CONFLICT', 'You cannot change your own role');
    if (isSelf && dto.status !== undefined && dto.status !== 'ACTIVE') throw conflict('CONFLICT', 'You cannot disable your own account');
    const losesSuper = targetIsSuper && ((dto.staffRole !== undefined && dto.staffRole !== 'SUPER_ADMIN') || (dto.status !== undefined && dto.status !== 'ACTIVE'));
    if (losesSuper && (await this.otherActiveSuperAdmins(id)) === 0) throw conflict('LAST_SUPER_ADMIN', 'At least one active SUPER_ADMIN must remain');

    const data: Prisma.UserUpdateInput = {};
    const changed: string[] = [];
    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName;
      changed.push('fullName');
    }
    if (dto.staffRole !== undefined && dto.staffRole !== target.staffRole) {
      data.staffRole = dto.staffRole;
      changed.push('staffRole');
    }
    if (dto.status !== undefined && dto.status !== target.status) {
      data.status = dto.status;
      changed.push('status');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = Object.keys(data).length ? await tx.user.update({ where: { id }, data }) : target;
      await this.audit.record(
        actor,
        { action: 'staff.update', entityType: 'User', entityId: id, metadata: { fields: changed, ...(dto.staffRole && { staffRole: dto.staffRole }), ...(dto.status && { status: dto.status }) } },
        tx,
      );
      return u;
    });
    // A disabled account must not keep working sessions (permissions themselves are read live on every request).
    if (dto.status !== undefined && dto.status !== 'ACTIVE') await this.sessions.revokeAllForUser(id);
    return toStaff(updated);
  }

  /** Generates a new temporary password (shown once), forces a change at next login and signs the user out everywhere. */
  async resetPassword(id: string, actor: AdminActor): Promise<{ temporaryPassword: string }> {
    const target = await this.loadTarget(id);
    if (target.staffRole === 'SUPER_ADMIN' && actor.staffRole !== 'SUPER_ADMIN') throw forbidden('Only a SUPER_ADMIN can reset a SUPER_ADMIN password');
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.passwords.hash(temporaryPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
      await this.audit.record(actor, { action: 'staff.reset_password', entityType: 'User', entityId: id, metadata: { email: target.email } }, tx);
    });
    await this.sessions.revokeAllForUser(id);
    return { temporaryPassword };
  }
}
