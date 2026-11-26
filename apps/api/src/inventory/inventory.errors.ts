import { ConflictException, NotFoundException } from '@nestjs/common';

export class InsufficientStockException extends ConflictException {
  constructor(variantId: string, locationId: string, requested: number) {
    super({
      code: 'INSUFFICIENT_STOCK',
      message: 'Not enough available stock to reserve the requested quantity',
      details: { variantId, locationId, requested },
    });
  }
}

export class InventoryItemNotFoundException extends NotFoundException {
  constructor(variantId: string, locationId: string) {
    super({ code: 'INVENTORY_ITEM_NOT_FOUND', message: 'No inventory record for this variant at this location', details: { variantId, locationId } });
  }
}
