-- Office expense management: the office (owner, full admins, accountants)
-- enters, edits and deletes expenses, and checks the ones drivers log from
-- the app. Additive only: no row is changed or removed.

CREATE TYPE "ExpenseSource" AS ENUM ('driver_app', 'office');

-- Every expense so far was logged by a driver from the app, so the default
-- fills the existing rows correctly.
ALTER TABLE "Expense" ADD COLUMN "source" "ExpenseSource" NOT NULL DEFAULT 'driver_app',
ADD COLUMN "createdById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewNote" VARCHAR(500);
