-- Figbloom platform (FLEET_PLATFORM_CONTRACT.md section 2): the outbox that
-- registers companies with the platform, what the platform knows about each,
-- the decision deliveries already applied, and the 'rejected' company status.

-- AlterEnum
ALTER TYPE "CompanyStatus" ADD VALUE 'rejected';

-- CreateTable
CREATE TABLE "PlatformSyncQueue" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "PlatformSyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformLink" (
    "kind" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "platformId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDecisionAt" TIMESTAMP(3),

    CONSTRAINT "PlatformLink_pkey" PRIMARY KEY ("kind","localId")
);

-- CreateTable
CREATE TABLE "PlatformDecisionDelivery" (
    "deliveryId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformDecisionDelivery_pkey" PRIMARY KEY ("deliveryId")
);

-- CreateIndex
CREATE INDEX "PlatformSyncQueue_doneAt_nextAttemptAt_idx" ON "PlatformSyncQueue"("doneAt", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSyncQueue_kind_localId_key" ON "PlatformSyncQueue"("kind", "localId");

-- Only the backend reads and writes these, as for every other table
-- (20261028115036_lock_tables_from_public_api).
ALTER TABLE "PlatformSyncQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformDecisionDelivery" ENABLE ROW LEVEL SECURITY;
