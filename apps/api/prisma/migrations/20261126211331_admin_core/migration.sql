-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SALES', 'ACCOUNTING', 'PRODUCTION', 'SUPPORT');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('STATUS', 'NOTE', 'DOCUMENT', 'EMAIL');

-- AlterTable
ALTER TABLE "CustomOrder" ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staffRole" "StaffRole";

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'HT',
    "taxId" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ORDER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "CustomOrderEvent_orderId_createdAt_idx" ON "CustomOrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomOrder_customerId_createdAt_idx" ON "CustomOrder"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderEvent" ADD CONSTRAINT "CustomOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderEvent" ADD CONSTRAINT "CustomOrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────── Backfill: customer directory + order timeline ───────────────

-- 1) One Customer per distinct order e-mail, with the details of the most recent order.
INSERT INTO "Customer" ("id", "email", "fullName", "company", "phone", "address", "city", "country", "source", "createdAt", "updatedAt")
SELECT 'cm' || substr(md5(random()::text || clock_timestamp()::text || o."email"), 1, 22),
       o."email", o."customerName", o."company", o."phone", o."address", o."city", 'HT', 'ORDER',
       first_seen.min_created, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (lower("email")) lower("email") AS "email", "customerName", "company", "phone", "address", "city"
  FROM "CustomOrder"
  ORDER BY lower("email"), "createdAt" DESC
) o
JOIN (
  SELECT lower("email") AS "email", MIN("createdAt") AS min_created FROM "CustomOrder" GROUP BY lower("email")
) first_seen ON first_seen."email" = o."email"
ON CONFLICT ("email") DO NOTHING;

-- 2) Customer accounts (non-staff users) that have no order yet.
INSERT INTO "Customer" ("id", "email", "fullName", "phone", "country", "source", "createdAt", "updatedAt")
SELECT 'cm' || substr(md5(random()::text || clock_timestamp()::text || u."email"), 1, 22),
       lower(u."email"),
       COALESCE(u."fullName", NULLIF(trim(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", '')), ''), split_part(u."email", '@', 1)),
       u."phone", 'HT', 'ACCOUNT', u."createdAt", CURRENT_TIMESTAMP
FROM "User" u
WHERE u."isStaff" = false
ON CONFLICT ("email") DO NOTHING;

-- 3) Link customers to their web account (matched by lower-cased e-mail).
UPDATE "Customer" c
SET "userId" = u."id"
FROM "User" u
WHERE lower(u."email") = c."email" AND u."isStaff" = false AND c."userId" IS NULL;

-- 4) Orders point to their customer.
UPDATE "CustomOrder" o
SET "customerId" = c."id"
FROM "Customer" c
WHERE c."email" = lower(o."email") AND o."customerId" IS NULL;

-- 5) Timeline: every existing order gets its "received" event.
INSERT INTO "CustomOrderEvent" ("id", "orderId", "type", "message", "createdAt")
SELECT 'ev' || substr(md5(random()::text || clock_timestamp()::text || o."id"), 1, 22),
       o."id", 'STATUS', 'Commande reçue', o."createdAt"
FROM "CustomOrder" o
WHERE NOT EXISTS (SELECT 1 FROM "CustomOrderEvent" e WHERE e."orderId" = o."id");
