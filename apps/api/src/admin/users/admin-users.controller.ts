import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiConflictResponse, ApiCookieAuth, ApiForbiddenResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthContext, AuthedRequest } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/current-auth.decorator';
import { OriginGuard } from '../../auth/guards';
import { actorOf } from '../admin-context';
import { RequirePermission, StaffGuard } from '../staff.guard';
import { CreateStaffDto, UpdateStaffDto } from './admin-users.dto';
import { AdminUsersService, type StaffUser } from './admin-users.service';

@ApiTags('admin · users')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Staff accounts' })
  list(): Promise<StaffUser[]> {
    return this.users.list();
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Create a staff account; the temporary password is returned ONCE in `temporaryPassword`' })
  @ApiConflictResponse({ description: 'EMAIL_TAKEN' })
  @ApiForbiddenResponse({ description: 'Only a SUPER_ADMIN can create a SUPER_ADMIN' })
  create(@Body() dto: CreateStaffDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<StaffUser & { temporaryPassword: string }> {
    return this.users.create(dto, actorOf(req, auth));
  }

  @Patch(':id')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Change name / role / status (disabling signs the user out). Cannot demote or disable yourself or the last SUPER_ADMIN' })
  @ApiConflictResponse({ description: 'LAST_SUPER_ADMIN · CONFLICT (self)' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<StaffUser> {
    return this.users.update(id, dto, actorOf(req, auth));
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'New temporary password (returned once); the user must change it at next login and is signed out everywhere' })
  resetPassword(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @Req() req: AuthedRequest): Promise<{ temporaryPassword: string }> {
    return this.users.resetPassword(id, actorOf(req, auth));
  }
}
