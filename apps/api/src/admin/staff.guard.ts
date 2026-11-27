import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, applyDecorators } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthedRequest } from '../auth/auth.types';
import { SessionService } from '../auth/session.service';
import { permissionsFor, type Permission } from './rbac';

const PERMISSION_KEY = 'admin:permission';
const SKIP_PASSWORD_GATE_KEY = 'admin:skip-password-gate';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The handler needs this permission (a route without it only needs an active staff session). */
export const RequirePermission = (permission: Permission) => applyDecorators(SetMetadata(PERMISSION_KEY, permission));

/** `GET /admin/me` must work while the temporary password is still pending, so the UI can show the change-password screen. */
export const AllowPasswordChangePending = () => SetMetadata(SKIP_PASSWORD_GATE_KEY, true);

/**
 * Back-office guard (use after `OriginGuard`):
 *  - 401 `UNAUTHENTICATED`: no / expired session;
 *  - 403 `CSRF_INVALID`: state-changing request without the CSRF header;
 *  - 403 `FORBIDDEN`: customer account, or the staff role lacks the permission;
 *  - 403 `PASSWORD_CHANGE_REQUIRED`: temporary password not changed yet.
 * Permissions are read from the database on every request (via the session lookup), so a role change applies immediately.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const auth = await this.sessions.resolve(this.sessions.tokenFromRequest(req));
    if (!auth) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
    if (!SAFE_METHODS.has(req.method) && !this.sessions.isCsrfValid(req, auth)) {
      throw new ForbiddenException({ code: 'CSRF_INVALID', message: 'Missing or invalid CSRF token' });
    }
    const user = auth.user;
    if (user.role !== 'STAFF' || !user.staffRole) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Staff access only' });
    }
    const handlerTargets = [context.getHandler(), context.getClass()];
    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(SKIP_PASSWORD_GATE_KEY, handlerTargets)) {
      throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your temporary password first' });
    }
    const needed = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, handlerTargets);
    if (needed && !permissionsFor(user.staffRole).includes(needed)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: `Missing permission: ${needed}` });
    }
    req.auth = auth;
    return true;
  }
}
