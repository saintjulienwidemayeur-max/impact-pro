-- CreateEnum
CREATE TYPE "QuoteRequestService" AS ENUM ('ARTICLES', 'SOURCING', 'EVENT', 'CONSULTING');

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'PROFORMA_SENT', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "service" "QuoteRequestService" NOT NULL,
    "size" TEXT,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'NEW',
    "fullName" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "quantity" INTEGER,
    "message" TEXT,
    "logoUploadId" UUID,
    "customerId" TEXT,
    "internalNote" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_reference_key" ON "QuoteRequest"("reference");

-- CreateIndex
CREATE INDEX "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteRequest_email_idx" ON "QuoteRequest"("email");

-- CreateIndex
CREATE INDEX "QuoteRequest_customerId_idx" ON "QuoteRequest"("customerId");

-- CreateIndex
CREATE INDEX "QuoteRequest_createdAt_idx" ON "QuoteRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_logoUploadId_fkey" FOREIGN KEY ("logoUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reference numbers DMD-YYYY-NNNNNN
CREATE SEQUENCE "quote_request_ref_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;
