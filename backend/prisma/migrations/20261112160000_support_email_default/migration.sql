-- Customer-facing support address: the old default belonged to another brand.
ALTER TABLE "PlatformSettings" ALTER COLUMN "supportEmail" SET DEFAULT 'support@figbloom.org';

-- Settings rows still on the old default move to the Figbloom address; a
-- value staff typed in themselves is left alone.
UPDATE "PlatformSettings" SET "supportEmail" = 'support@figbloom.org' WHERE "supportEmail" = 'support@getour.com';
