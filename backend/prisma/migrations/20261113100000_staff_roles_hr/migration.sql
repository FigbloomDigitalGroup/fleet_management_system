-- Staff roles and Figbloom HR (FLEET_HR_CONTRACT.md sections 0 and 3).

-- New company roles. Not used elsewhere in this migration, so adding enum
-- values inside the migration's transaction is safe (PostgreSQL 12+).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPERATOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MECHANIC';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERVISOR';

-- Inspection sign-off (supervisor, mechanic, full admin, owner).
ALTER TABLE "Inspection" ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewNote" VARCHAR(500);

-- The outbox's staff rows (fleet.staff.*) keep the person's company.
ALTER TABLE "PlatformSyncQueue" ADD COLUMN "companyId" TEXT;

-- Event deliveries from the platform relay, applied once each.
CREATE TABLE "PlatformEventDelivery" (
    "deliveryId" TEXT NOT NULL,
    "eventId" TEXT,
    "type" TEXT NOT NULL,
    "companyId" TEXT,
    "personId" TEXT,
    "outcome" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEventDelivery_pkey" PRIMARY KEY ("deliveryId")
);

-- Leave approved in Figbloom HR: the person is unavailable for dispatch.
CREATE TABLE "DriverUnavailability" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'hr',
    "applicationId" TEXT NOT NULL,
    "leaveType" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "lastEventAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverUnavailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverUnavailability_companyId_source_applicationId_key" ON "DriverUnavailability"("companyId", "source", "applicationId");
CREATE INDEX "DriverUnavailability_userId_status_startDate_idx" ON "DriverUnavailability"("userId", "status", "startDate");

-- Keep the new tables away from Supabase's public API, like the others.
ALTER TABLE "PlatformEventDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriverUnavailability" ENABLE ROW LEVEL SECURITY;
