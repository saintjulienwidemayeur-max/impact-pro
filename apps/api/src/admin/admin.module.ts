import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { BillingStatsProviderImpl } from '../billing/billing-stats.provider';
import { CustomersModule } from '../customers/customers.module';
import { AdminMeController } from './admin-me.controller';
import { AdminAuditController } from './audit/admin-audit.controller';
import { AdminBootstrapService } from './bootstrap/admin-bootstrap.service';
import { AdminCustomersController } from './customers/admin-customers.controller';
import { AdminCustomersService } from './customers/admin-customers.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminOrdersController } from './orders/admin-orders.controller';
import { AdminOrdersService } from './orders/admin-orders.service';
import { BILLING_STATS } from './ports/billing-stats.port';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminProductsService } from './products/admin-products.service';
import { StaffGuard } from './staff.guard';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  imports: [AuthModule, CustomersModule, BillingModule],
  controllers: [
    AdminMeController,
    AdminDashboardController,
    AdminOrdersController,
    AdminCustomersController,
    AdminProductsController,
    AdminUsersController,
    AdminAuditController,
  ],
  providers: [
    StaffGuard,
    AdminBootstrapService,
    AdminOrdersService,
    AdminCustomersService,
    AdminProductsService,
    AdminUsersService,
    AdminDashboardService,
    // Real billing statistics (billing module merged).
    { provide: BILLING_STATS, useExisting: BillingStatsProviderImpl },
  ],
  exports: [BILLING_STATS],
})
export class AdminModule {}
