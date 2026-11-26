import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext, AuthedRequest } from './auth.types';

/** The authenticated session of the request; only valid on routes protected by `SessionGuard`. */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new Error('CurrentAuth used on a route without SessionGuard');
  return req.auth;
});
