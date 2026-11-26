-- CreateEnum
CREATE TYPE "PrintPlacement" AS ENUM ('FRONT', 'BACK', 'CHEST_LEFT', 'SLEEVE', 'WRAP', 'FULL');

-- CreateEnum
CREATE TYPE "CustomOrderStatus" AS ENUM ('RECEIVED', 'MOCKUP_SENT', 'APPROVED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "compareAtPrice" DECIMAL(14,2),
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "placements" "PrintPlacement"[] DEFAULT ARRAY[]::"PrintPlacement"[],
ADD COLUMN     "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unitLabel" TEXT NOT NULL DEFAULT 'pièce';

-- CreateTable
CREATE TABLE "Upload" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "CustomOrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "currency" CHAR(3) NOT NULL DEFAULT 'HTG',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "customerName" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "notes" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productSlug" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "color" TEXT,
    "size" TEXT,
    "placement" "PrintPlacement" NOT NULL,
    "uploadId" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Upload_storageKey_key" ON "Upload"("storageKey");

-- CreateIndex
CREATE INDEX "Upload_createdAt_idx" ON "Upload"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrder_reference_key" ON "CustomOrder"("reference");

-- CreateIndex
CREATE INDEX "CustomOrder_email_idx" ON "CustomOrder"("email");

-- CreateIndex
CREATE INDEX "CustomOrder_status_createdAt_idx" ON "CustomOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomOrderItem_orderId_idx" ON "CustomOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "CustomOrderItem_productId_idx" ON "CustomOrderItem"("productId");

-- CreateIndex
CREATE INDEX "CustomOrderItem_uploadId_idx" ON "CustomOrderItem"("uploadId");

-- AddForeignKey
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Human-readable order references (IP-YYYY-NNNNNN). Sequences are concurrency-safe and never reuse values.
CREATE SEQUENCE "custom_order_ref_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Money and quantity invariants.
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_prices_nonnegative" CHECK ("unitPrice" >= 0 AND "lineTotal" >= 0);
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_subtotal_nonnegative" CHECK ("subtotal" >= 0);
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_size_positive" CHECK ("size" > 0);
