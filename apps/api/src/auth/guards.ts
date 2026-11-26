import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import type { AuthedRequest } from './auth.types';
import { SessionService } from './session.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Browsers always send `Origin` on cross-site writes. When it is present it must be one of the configured storefront
 * origins; requests without it (curl, server-to-server, same-origin GET) are allowed. Defence in depth next to SameSite=Lax + CSRF token.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    const origin = req.get('origin');
    if (origin && !this.env.CORS_ORIGINS.includes(origin)) {
      throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed' });
    }
    return true;
  }
}

/** Requires a valid session cookie and, for state-changing methods, a valid CSRF header. Attaches `req.auth`. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const auth = await this.sessions.resolve(this.sessions.tokenFromRequest(req));
    if (!auth) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
    if (!SAFE_METHODS.has(req.method) && !this.sessions.isCsrfValid(req, auth)) {
      throw new ForbiddenException({ code: 'CSRF_INVALID', message: 'Missing or invalid CSRF token' });
    }
    req.auth = auth;
    return true;
  }
}
