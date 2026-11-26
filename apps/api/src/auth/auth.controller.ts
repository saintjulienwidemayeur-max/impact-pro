import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { loginThrottle, registerThrottle } from '../common/throttle-limits';
import { AuthService, type RequestMeta } from './auth.service';
import type { AuthUser, AuthedRequest } from './auth.types';
import { CurrentAuth } from './current-auth.decorator';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateMeDto } from './dto/auth.dto';
import { OriginGuard, SessionGuard } from './guards';
import { SessionService } from './session.service';
import type { AuthContext } from './auth.types';

const metaOf = (req: AuthedRequest): RequestMeta => ({ ipAddress: req.ip, userAgent: req.get('user-agent') ?? undefined, requestId: req.id });

interface SessionPayload {
  user: AuthUser;
  csrfToken: string;
}

@ApiTags('auth')
@UseGuards(OriginGuard)
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  @HttpCode(201)
  @Throttle(registerThrottle)
  @ApiOperation({ summary: 'Create a customer account and sign in (sets the ip_session and ip_csrf cookies)' })
  @ApiCreatedResponse({ description: '{ data: { user, csrfToken } }' })
  @ApiConflictResponse({ description: 'EMAIL_TAKEN' })
  @ApiUnprocessableEntityResponse({ description: 'VALIDATION_ERROR (incl. password policy: too short, too common…)' })
  @ApiTooManyRequestsResponse({ description: '5 sign-ups / hour / IP' })
  async register(@Body() dto: RegisterDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<SessionPayload> {
    const { user, token } = await this.auth.register(dto, metaOf(req));
    this.sessions.setCookies(res, token);
    return { user, csrfToken: this.sessions.csrfFor(token) };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(loginThrottle)
  @ApiOperation({ summary: 'Sign in; a new session replaces any previous one presented by the browser' })
  @ApiOkResponse({ description: '{ data: { user, csrfToken } }' })
  @ApiUnauthorizedResponse({ description: 'INVALID_CREDENTIALS (same answer for unknown e-mail and wrong password)' })
  @ApiTooManyRequestsResponse({ description: 'TOO_MANY_ATTEMPTS (per-e-mail lockout) or 10 logins / 15 min / IP' })
  async login(@Body() dto: LoginDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<SessionPayload> {
    const { user, token } = await this.auth.login(dto, metaOf(req), this.sessions.tokenFromRequest(req));
    this.sessions.setCookies(res, token);
    return { user, csrfToken: this.sessions.csrfFor(token) };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth('ip_session')
  @ApiOperation({ summary: 'Revoke the current session and clear the cookies (needs x-csrf-token)' })
  @ApiForbiddenResponse({ description: 'CSRF_INVALID' })
  async logout(@CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    await this.auth.logout(auth.user.id, auth.sessionId, metaOf(req));
    this.sessions.clearCookies(res);
    return { ok: true };
  }

  @Get('me')
  @ApiCookieAuth('ip_session')
  @ApiOperation({
    summary: 'Current user, or { user: null } for guests (200 in both cases, so guest page views do not log 401s)',
    description: 'Also re-issues the readable ip_csrf cookie and returns the CSRF token to echo in x-csrf-token.',
  })
  @ApiOkResponse({ description: '{ data: { user: User | null, csrfToken: string | null } }' })
  async me(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<{ user: AuthUser | null; csrfToken: string | null }> {
    const ctx = await this.sessions.resolve(this.sessions.tokenFromRequest(req));
    if (!ctx) return { user: null, csrfToken: null };
    this.sessions.setCookies(res, ctx.token);
    return { user: ctx.user, csrfToken: ctx.csrfToken };
  }

  @Get('csrf')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('ip_session')
  @ApiOperation({ summary: 'CSRF token for the current session' })
  csrf(@CurrentAuth() auth: AuthContext): { csrfToken: string } {
    return { csrfToken: auth.csrfToken };
  }

  @Patch('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('ip_session')
  @ApiOperation({ summary: 'Update name / phone (needs x-csrf-token)' })
  async updateMe(@CurrentAuth() auth: AuthContext, @Body() dto: UpdateMeDto): Promise<{ user: AuthUser }> {
    return { user: await this.auth.updateMe(auth.user.id, dto) };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth('ip_session')
  @ApiOperation({ summary: 'Change the password; every other session of the user is revoked (needs x-csrf-token)' })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_CURRENT_PASSWORD · PASSWORD_UNCHANGED · VALIDATION_ERROR (policy)' })
  changePassword(@CurrentAuth() auth: AuthContext, @Body() dto: ChangePasswordDto, @Req() req: AuthedRequest): Promise<{ revokedSessions: number }> {
    return this.auth.changePassword(auth.user.id, auth.sessionId, dto, metaOf(req));
  }
}
