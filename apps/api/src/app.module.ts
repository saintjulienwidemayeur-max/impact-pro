import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './common/audit.service';
import { CustomersModule } from './customers/customers.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { AppConfigModule, ENV } from './config/config.module';
import type { Env } from './config/env';
import { CatalogModule } from './catalog/catalog.module';
import { CustomOrdersModule } from './custom-orders/custom-orders.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => [{ ttl: env.THROTTLE_TTL_MS, limit: env.THROTTLE_LIMIT }],
    }),
    PrismaModule,
    AuditModule,
    CustomersModule,
    AuthModule,
    AdminModule,
    HealthModule,
    InventoryModule,
    StorageModule,
    CatalogModule,
    UploadsModule,
    CustomOrdersModule,
    BillingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
