import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';

// HTTP endpoints for inventory arrive in Phase 7 behind auth/RBAC; the service is exported for internal use.
@Module({ providers: [InventoryService], exports: [InventoryService] })
export class InventoryModule {}
