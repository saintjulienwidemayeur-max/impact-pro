import { Inject, Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext, AuthUser } from './auth.types';
import { toAuthUser } from './auth-user';

export const SESSION_COOKIE = 'ip_session';
export const CSRF_COOKIE = 'ip_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A used session is only written back (sliding expiry) when it was last touched more than this long ago. */
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

/**
 * Server-side sessions. The browser holds an opaque 256-bit random token in an HTTP-only cookie; only its SHA-256 is
 * stored (so a database leak cannot be replayed). The CSRF token is an HMAC of the session token (signed double-submit):
 * it is readable by the storefront script (cookie `ip_csrf`) and must be echoed in the `x-csrf-token` header.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Idle / absolute lifetimes in ms: short for back-office staff, long for customers. */
  private lifetimes(staff: boolean): { idle: number; absolute: number } {
    return staff
      ? { idle: this.env.STAFF_SESSION_IDLE_HOURS * HOUR_MS, absolute: this.env.STAFF_SESSION_ABSOLUTE_HOURS * HOUR_MS }
      : { idle: this.env.SESSION_TTL_DAYS * DAY_MS, absolute: this.env.SESSION_ABSOLUTE_TTL_DAYS * DAY_MS };
  }

  async create(userId: string, meta: { ipAddress?: string; userAgent?: string }, opts: { staff?: boolean } = {}): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    const { idle, absolute } = this.lifetimes(Boolean(opts.staff));
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: sha256Hex(token),
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt: new Date(now + idle),
        absoluteExpiresAt: new Date(now + absolute),
        lastUsedAt: new Date(now),
      },
    });
    return token;
  }

  /** Looks the token up; returns null for unknown / revoked / expired sessions and for disabled users. */
  async resolve(token: string | undefined): Promise<AuthContext | null> {
    if (!token || token.length < 20 || token.length > 200) return null;
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: sha256Hex(token) }, include: { user: true } });
    if (!session || session.revokedAt) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now) return null;
    if (session.absoluteExpiresAt && session.absoluteExpiresAt.getTime() <= now) return null;
    if (session.user.status !== 'ACTIVE') return null;

    if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      // Sliding expiry: extend by the idle window, never past the absolute limit.
      let next = now + this.lifetimes(session.user.isStaff).idle;
      if (session.absoluteExpiresAt) next = Math.min(next, session.absoluteExpiresAt.getTime());
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now), expiresAt: new Date(next) } });
    }

    const user: AuthUser = toAuthUser(session.user);
    return { sessionId: session.id, token, csrfToken: this.csrfFor(token), user };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Revokes every active session of the user, optionally keeping one (the current one after a password change). */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const res = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  csrfFor(token: string): string {
    return createHmac('sha256', this.env.COOKIE_SECRET).update(`csrf:${token}`).digest('base64url');
  }

  /** Constant-time comparison of the `x-csrf-token` header with the token derived from the session. */
  isCsrfValid(req: Request, ctx: AuthContext): boolean {
    const header = req.get(CSRF_HEADER);
    if (!header) return false;
    const a = Buffer.from(header);
    const b = Buffer.from(ctx.csrfToken);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  tokenFromRequest(req: Request): string | undefined {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  /** The signed-in user of this request, only when the CSRF header is valid too (used by endpoints that accept guests). */
  async userForRequest(req: Request): Promise<AuthContext | null> {
    const ctx = await this.resolve(this.tokenFromRequest(req));
    return ctx && this.isCsrfValid(req, ctx) ? ctx : null;
  }

  setCookies(res: Response, token: string, opts: { staff?: boolean } = {}): void {
    const secure = this.env.NODE_ENV === 'production';
    const maxAge = this.lifetimes(Boolean(opts.staff)).idle;
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge });
    res.cookie(CSRF_COOKIE, this.csrfFor(token), { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge });
  }

  clearCookies(res: Response): void {
    const secure = this.env.NODE_ENV === 'production';
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    res.clearCookie(CSRF_COOKIE, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
  }
}
