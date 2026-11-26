-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('PER_PIECE', 'PER_AREA');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('LOGO', 'ARTWORK');

-- CreateEnum
CREATE TYPE "ElementKind" AS ENUM ('LOGO', 'TEXT', 'ARTWORK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PrintPlacement" ADD VALUE 'SIDE';
ALTER TYPE "PrintPlacement" ADD VALUE 'TOP';

-- AlterTable
ALTER TABLE "CustomOrderItem" ADD COLUMN     "areaM2" DECIMAL(10,4),
ADD COLUMN     "heightCm" DECIMAL(8,1),
ADD COLUMN     "widthCm" DECIMAL(8,1),
ALTER COLUMN "placement" DROP NOT NULL,
ALTER COLUMN "uploadId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "artworkRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customSize" JSONB,
ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'PER_PIECE',
ADD COLUMN     "supportsArtwork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsLogo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportsText" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "purpose" "UploadPurpose" NOT NULL DEFAULT 'LOGO';

-- CreateTable
CREATE TABLE "CustomOrderItemElement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "placement" "PrintPlacement" NOT NULL,
    "kind" "ElementKind" NOT NULL,
    "uploadId" UUID,
    "text" TEXT,
    "font" TEXT,
    "fontWeight" TEXT,
    "color" TEXT,
    "align" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomOrderItemElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomOrderItemElement_uploadId_idx" ON "CustomOrderItemElement"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrderItemElement_itemId_sort_key" ON "CustomOrderItemElement"("itemId", "sort");

-- AddForeignKey
ALTER TABLE "CustomOrderItemElement" ADD CONSTRAINT "CustomOrderItemElement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CustomOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItemElement" ADD CONSTRAINT "CustomOrderItemElement_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every pre-existing single-logo item becomes one centered LOGO element.
INSERT INTO "CustomOrderItemElement" ("id", "itemId", "sort", "placement", "kind", "uploadId", "x", "y", "scale", "rotation")
SELECT 'legacy_' || "id", "id", 0, "placement", 'LOGO', "uploadId", 0, 0, 1, 0
FROM "CustomOrderItem"
WHERE "uploadId" IS NOT NULL AND "placement" IS NOT NULL;
