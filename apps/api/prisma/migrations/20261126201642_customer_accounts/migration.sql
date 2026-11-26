-- AlterTable
ALTER TABLE "CustomOrder" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "absoluteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fullName" TEXT;

-- CreateIndex
CREATE INDEX "CustomOrder_userId_createdAt_idx" ON "CustomOrder"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
