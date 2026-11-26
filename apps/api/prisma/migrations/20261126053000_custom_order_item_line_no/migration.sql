-- No custom orders exist before this migration (feature introduced in the previous migration), so a NOT NULL column without default is safe.
-- DropIndex
DROP INDEX "CustomOrderItem_orderId_idx";

-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN     "lineNo" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrderItem_orderId_lineNo_key" ON "CustomOrderItem"("orderId", "lineNo");


ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_lineNo_positive" CHECK ("lineNo" > 0);
