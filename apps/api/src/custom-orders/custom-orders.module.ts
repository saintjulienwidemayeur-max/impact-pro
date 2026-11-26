import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomOrdersController } from './custom-orders.controller';
import { CustomOrdersService } from './custom-orders.service';
import { MeOrdersController } from './me-orders.controller';

@Module({
  imports: [CatalogModule, AuthModule],
  // `me/orders/claim` must be registered before `me/orders/:reference` (same controller, declared in that order).
  controllers: [CustomOrdersController, MeOrdersController],
  providers: [CustomOrdersService],
})
export class CustomOrdersModule {}
