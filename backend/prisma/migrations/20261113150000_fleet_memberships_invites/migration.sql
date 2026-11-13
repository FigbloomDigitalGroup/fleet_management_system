-- Fleet memberships (one account, many fleets) and invite by email
-- (FLEET_MEMBERSHIPS_CONTRACT.md section 1).
--
-- Data-preserving and safe to run again: every statement checks before it
-- creates, and the copies skip what is already there.
--
-- - User becomes the person's identity: isPlatformAdmin (from the
--   PLATFORM_ADMIN role) and identitySub (unused for now). User.role,
--   User.companyId and User.adminAccess stay, nullable and no longer read,
--   for one release; they are dropped later. User.companyId loses its
--   foreign key, so removing a company no longer deletes the people in it
--   (only their membership there).
-- - Membership: one per existing company user, from companyId + role (+ the
--   admin access level); a deactivated user's membership is "disabled".
-- - Invitation and TeamAuditLog: new, empty.
-- - The HR outbox (PlatformSyncQueue / PlatformLink kind "staff") is keyed
--   per membership now ("<user id>:<company id>"): existing rows are renamed.

DO $$ BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- User: identity only
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_companyId_fkey";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "identitySub" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "role" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "adminAccess" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "adminAccess" DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_identitySub_key" ON "User"("identitySub");

-- ---- New tables
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "adminAccess" "AdminAccess",
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "invitedById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "adminAccess" "AdminAccess",
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamAuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "email" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Membership_companyId_role_idx" ON "Membership"("companyId", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "Invitation_companyId_email_idx" ON "Invitation"("companyId", "email");
CREATE INDEX IF NOT EXISTS "TeamAuditLog_companyId_createdAt_idx" ON "TeamAuditLog"("companyId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Keep the new tables away from Supabase's public API, like the others.
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamAuditLog" ENABLE ROW LEVEL SECURITY;

-- ---- Copy what people are today

-- Figbloom staff.
UPDATE "User" SET "isPlatformAdmin" = true
WHERE "role" = 'PLATFORM_ADMIN' AND "isPlatformAdmin" = false;

-- One membership per company user: same role, the admin access level for
-- ADMINs, disabled when the account was switched off. createdAt is when the
-- person joined, so lists keep their order.
INSERT INTO "Membership" ("id", "userId", "companyId", "role", "adminAccess", "status", "createdAt", "updatedAt")
SELECT
    'mbr_' || u."id",
    u."id",
    u."companyId",
    u."role",
    CASE WHEN u."role" = 'ADMIN' THEN COALESCE(u."adminAccess", 'full') ELSE NULL END,
    CASE WHEN u."status" = 'active' THEN 'active'::"MembershipStatus" ELSE 'disabled'::"MembershipStatus" END,
    u."createdAt",
    CURRENT_TIMESTAMP
FROM "User" u
JOIN "Company" c ON c."id" = u."companyId"
WHERE u."role" IS NOT NULL AND u."role" <> 'PLATFORM_ADMIN'
ON CONFLICT ("userId", "companyId") DO NOTHING;

-- HR outbox: "staff" rows and links were one per person (localId = user id),
-- now one per membership (localId = "<user id>:<company id>"). Ids never
-- contain ":", so rows already renamed are left alone.
UPDATE "PlatformSyncQueue"
SET "localId" = "localId" || ':' || "companyId"
WHERE "kind" = 'staff' AND "companyId" IS NOT NULL AND strpos("localId", ':') = 0;

UPDATE "PlatformLink" l
SET "localId" = l."localId" || ':' || u."companyId"
FROM "User" u
WHERE l."kind" = 'staff' AND strpos(l."localId", ':') = 0 AND u."id" = l."localId" AND u."companyId" IS NOT NULL;
