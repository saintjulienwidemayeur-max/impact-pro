import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth.types';
import type { ChangePasswordDto, LoginDto, RegisterDto, UpdateMeDto } from './dto/auth.dto';
import { LoginAttemptsService } from './login-attempts.service';
import { PASSWORD_MESSAGES, PasswordService, checkPasswordPolicy } from './password.service';
import { SessionService, sha256Hex } from './session.service';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || null),
  phone: u.phone,
  role: u.isStaff ? 'STAFF' : 'CUSTOMER',
  emailVerified: Boolean(u.emailVerified),
  createdAt: u.createdAt.toISOString(),
});

/** Same message for unknown e-mail, wrong password and disabled account: nothing to enumerate. */
const invalidCredentials = () =>
  new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect.' });

function passwordError(field: string, problems: ReturnType<typeof checkPasswordPolicy>): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: [{ field, messages: problems.map((p) => PASSWORD_MESSAGES[p]), codes: problems }],
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<{ user: AuthUser; token: string }> {
    const problems = checkPasswordPolicy(dto.password, { email: dto.email });
    if (problems.length) throw passwordError('password', problems);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (existing) throw this.emailTaken();

    const passwordHash = await this.passwords.hash(dto.password);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email: dto.email, fullName: dto.fullName, phone: dto.phone ?? null, passwordHash, lastLoginAt: new Date() },
      });
    } catch (e) {
      // Two sign-ups racing for the same e-mail: the unique index decides.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw this.emailTaken();
      throw e;
    }
    const token = await this.sessions.create(user.id, meta);
    await this.audit('auth.register', user.id, meta);
    return { user: toAuthUser(user), token };
  }

  async login(dto: LoginDto, meta: RequestMeta, previousToken?: string): Promise<{ user: AuthUser; token: string }> {
    const wait = this.attempts.retryAfterSeconds(dto.email);
    if (wait > 0) {
      await this.audit('auth.login_blocked', null, meta, { emailHash: this.emailHash(dto.email), retryAfterSeconds: wait });
      throw new HttpException(
        { code: 'TOO_MANY_ATTEMPTS', message: 'Trop de tentatives. Réessayez plus tard.', details: { retryAfterSeconds: wait } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always run one Argon2 verification (dummy hash when there is nothing to verify against).
    const ok = await this.passwords.verify(user?.passwordHash, dto.password);
    if (!user || !ok || user.status !== 'ACTIVE') {
      this.attempts.recordFailure(dto.email);
      await this.audit('auth.login_failed', user?.id ?? null, meta, {
        reason: !user ? 'unknown_email' : user.status !== 'ACTIVE' ? 'inactive' : 'bad_password',
        emailHash: this.emailHash(dto.email),
      });
      throw invalidCredentials();
    }

    this.attempts.recordSuccess(dto.email);
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    // Session rotation: a login always gets a brand-new token, and the one the browser presented (if any) dies.
    if (previousToken) {
      const prev = await this.sessions.resolve(previousToken);
      if (prev) await this.sessions.revoke(prev.sessionId);
    }
    const token = await this.sessions.create(user.id, meta);
    await this.audit('auth.login', user.id, meta);
    return { user: toAuthUser(updated), token };
  }

  async logout(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(sessionId);
    await this.audit('auth.logout', userId, meta);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<AuthUser> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return toAuthUser(user);
  }

  /** Verifies the current password, sets the new one and signs every other device out. */
  async changePassword(userId: string, currentSessionId: string, dto: ChangePasswordDto, meta: RequestMeta): Promise<{ revokedSessions: number }> {
    const key = `pw:${userId}`;
    const wait = this.attempts.retryAfterSeconds(key);
    if (wait > 0) {
      throw new HttpException(
        { code: 'TOO_MANY_ATTEMPTS', message: 'Trop de tentatives. Réessayez plus tard.', details: { retryAfterSeconds: wait } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      this.attempts.recordFailure(key);
      await this.audit('auth.password_change_failed', userId, meta);
      throw new UnprocessableEntityException({ code: 'INVALID_CURRENT_PASSWORD', message: 'Le mot de passe actuel est incorrect.' });
    }
    this.attempts.recordSuccess(key);
    const problems = checkPasswordPolicy(dto.newPassword, { email: user.email });
    if (problems.length) throw passwordError('newPassword', problems);
    if (dto.newPassword === dto.currentPassword) {
      throw new UnprocessableEntityException({ code: 'PASSWORD_UNCHANGED', message: 'Le nouveau mot de passe doit être différent de l’ancien.' });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.passwords.hash(dto.newPassword) } });
    const revokedSessions = await this.sessions.revokeAllForUser(userId, currentSessionId);
    await this.audit('auth.password_change', userId, meta, { revokedSessions });
    return { revokedSessions };
  }

  private emailTaken(): ConflictException {
    return new ConflictException({ code: 'EMAIL_TAKEN', message: 'Un compte existe déjà avec cet e-mail.' });
  }

  /** Short, non-reversible fingerprint for audit rows about e-mails that may not belong to any account. */
  private emailHash(email: string): string {
    return sha256Hex(email).slice(0, 16);
  }

  private async audit(action: string, actorId: string | null, meta: RequestMeta, metadata?: Prisma.InputJsonObject): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action,
        actorId,
        entityType: 'User',
        entityId: actorId,
        metadata,
        ipAddress: meta.ipAddress ?? null,
        requestId: meta.requestId ?? null,
      },
    });
  }
}
