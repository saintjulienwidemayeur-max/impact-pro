import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiForbiddenResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { OriginGuard } from '../auth/guards';
import { AllowPasswordChangePending, StaffGuard } from './staff.guard';

@ApiTags('admin · me')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/me', version: '1' })
export class AdminMeController {
  @Get()
  @AllowPasswordChangePending()
  @ApiOperation({ summary: 'The signed-in staff member with role, permissions and the forced-password-change flag' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHENTICATED' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN (customer account)' })
  me(@CurrentAuth() auth: AuthContext) {
    const u = auth.user;
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      staffRole: u.staffRole,
      permissions: u.permissions ?? [],
      mustChangePassword: Boolean(u.mustChangePassword),
    };
  }
}
