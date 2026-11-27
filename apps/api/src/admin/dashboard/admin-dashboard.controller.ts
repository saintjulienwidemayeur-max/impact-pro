import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OriginGuard } from '../../auth/guards';
import { RequirePermission, StaffGuard } from '../staff.guard';
import { AdminDashboardService, type DashboardView } from './admin-dashboard.service';

@ApiTags('admin · dashboard')
@ApiCookieAuth('ip_session')
@SkipThrottle()
@UseGuards(OriginGuard, StaffGuard)
@Controller({ path: 'admin/dashboard', version: '1' })
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  @RequirePermission('dashboard.read')
  @ApiOperation({ summary: 'KPIs: orders by status, revenue, customers, documents, recent orders, top products, activity' })
  get(): Promise<DashboardView> {
    return this.dashboard.get();
  }
}
