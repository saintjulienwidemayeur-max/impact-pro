import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermission } from '../admin/rbac/require-permission.decorator';
import { StaffGuard } from '../admin/rbac/staff.guard';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { OriginGuard, SessionGuard } from '../auth/guards';
import { BillingSettingsService, type BillingSettingsView } from './billing-settings.service';
import { BillingSettingsDto, RevenueQuery } from './dto/billing.dto';
import { ReportsService, type AgingRow, type RevenueRow } from './reports.service';

@ApiTags('billing')
@ApiCookieAuth('ip_session')
@UseGuards(OriginGuard, SessionGuard, StaffGuard)
@Controller({ path: 'admin/billing/settings', version: '1' })
export class BillingSettingsController {
  constructor(private readonly settings: BillingSettingsService) {}

  @Get()
  @RequirePermission('billing.settings')
  @ApiOperation({ summary: 'Company identity, defaults, numbering prefixes and the next numbers' })
  get(): Promise<BillingSettingsView> {
    return this.settings.get();
  }

  @Put()
  @RequirePermission('billing.settings')
  update(@CurrentAuth() auth: AuthContext, @Body() dto: BillingSettingsDto, @Req() req: Request & { id?: string }): Promise<BillingSettingsView> {
    return this.settings.update(dto, auth.user.id, { ipAddress: req.ip, requestId: req.id });
  }
}

@ApiTags('billing')
@ApiCookieAuth('ip_session')
@UseGuards(OriginGuard, SessionGuard, StaffGuard)
@Controller({ path: 'admin/reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('revenue')
  @RequirePermission('reports.read')
  @ApiOperation({ summary: 'Invoiced and paid amounts per period (day|month) and currency' })
  revenue(@Query() q: RevenueQuery): Promise<RevenueRow[]> {
    return this.reports.revenue(q.from, q.to, q.groupBy);
  }

  @Get('aging')
  @RequirePermission('reports.read')
  @ApiOperation({ summary: 'Receivables ageing buckets per currency' })
  aging(): Promise<AgingRow[]> {
    return this.reports.aging();
  }
}
