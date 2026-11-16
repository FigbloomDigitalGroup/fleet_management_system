-- Figbloom sign-in (ERP/FLEET_COGNITO_CONTRACT.md section 2): Figbloom staff
-- sign in to the staff area through Cognito's staff pool, a different account
-- from the customers-pool one in identitySub. Additive only.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffIdentitySub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_staffIdentitySub_key" ON "User"("staffIdentitySub");
