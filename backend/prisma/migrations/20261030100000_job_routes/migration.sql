-- CreateTable
CREATE TABLE "JobRoute" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "path" JSONB NOT NULL DEFAULT '[]',
    "jobIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "durationMin" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobRoute_driverId_scheduledDate_key" ON "JobRoute"("driverId", "scheduledDate");

-- CreateIndex
CREATE INDEX "JobRoute_companyId_scheduledDate_idx" ON "JobRoute"("companyId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "JobRoute" ADD CONSTRAINT "JobRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRoute" ADD CONSTRAINT "JobRoute_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same lock as every other table (see lock_tables_from_public_api).
ALTER TABLE "JobRoute" ENABLE ROW LEVEL SECURITY;
