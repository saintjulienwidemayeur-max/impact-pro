-- AlterEnum
ALTER TYPE "UploadPurpose" ADD VALUE 'PREVIEW';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "colorLabel" TEXT NOT NULL DEFAULT 'Couleur',
ADD COLUMN     "colorsRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sizeLabel" TEXT NOT NULL DEFAULT 'Taille',
ADD COLUMN     "sizesRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CustomOrderItemPreview" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "placement" "PrintPlacement" NOT NULL,
    "uploadId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomOrderItemPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomOrderItemPreview_uploadId_idx" ON "CustomOrderItemPreview"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrderItemPreview_itemId_placement_key" ON "CustomOrderItemPreview"("itemId", "placement");

-- AddForeignKey
ALTER TABLE "CustomOrderItemPreview" ADD CONSTRAINT "CustomOrderItemPreview_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CustomOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItemPreview" ADD CONSTRAINT "CustomOrderItemPreview_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
