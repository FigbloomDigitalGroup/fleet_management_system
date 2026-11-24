-- HR connect: a company without Figbloom HR asks for it (POST /api/hr/request)
-- and Figbloom staff see the request in the console. Additive only.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "hrRequestedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "hrRequestedById" TEXT;
