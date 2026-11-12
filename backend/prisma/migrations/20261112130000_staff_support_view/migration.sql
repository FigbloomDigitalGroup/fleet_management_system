-- Figbloom staff: read-only support view sessions and the staff audit log.

-- CreateTable
CREATE TABLE "SupportSession" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAuditLog" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "staffEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sessionId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportSession_staffUserId_endedAt_idx" ON "SupportSession"("staffUserId", "endedAt");

-- CreateIndex
CREATE INDEX "SupportSession_companyId_startedAt_idx" ON "SupportSession"("companyId", "startedAt");

-- CreateIndex
CREATE INDEX "StaffAuditLog_companyId_createdAt_idx" ON "StaffAuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffAuditLog_staffUserId_createdAt_idx" ON "StaffAuditLog"("staffUserId", "createdAt");

-- Only the backend reads and writes these, as for every other table
-- (20261028115036_lock_tables_from_public_api).
ALTER TABLE "SupportSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffAuditLog" ENABLE ROW LEVEL SECURITY;
