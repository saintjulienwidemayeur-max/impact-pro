import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
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
import { BILLING_STATS, ZeroBillingStatsProvider } from './ports/billing-stats.port';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminProductsService } from './products/admin-products.service';
import { StaffGuard } from './staff.guard';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  imports: [AuthModule, CustomersModule],
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
    // Rebind to the real billing statistics once the billing module is merged (see ports/billing-stats.port.ts).
    { provide: BILLING_STATS, useClass: ZeroBillingStatsProvider },
  ],
  exports: [BILLING_STATS],
})
export class AdminModule {}
