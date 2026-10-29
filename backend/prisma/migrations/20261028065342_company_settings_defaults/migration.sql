/*
  Warnings:

  - Made the column `alertSettings` on table `Company` required. This step will fail if there are existing NULL values in that column.
  - Made the column `trackingHours` on table `Company` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "alertSettings" SET NOT NULL,
ALTER COLUMN "alertSettings" SET DEFAULT '{"speedLimitKph":80,"idleMinutes":10,"offlineMinutes":15,"lowBatteryPercent":15,"harshBrakingKphPerSec":12,"harshAccelerationKphPerSec":10,"disabledTypes":[],"emailRecipientIds":[],"emailTypes":[]}',
ALTER COLUMN "trackingHours" SET NOT NULL,
ALTER COLUMN "trackingHours" SET DEFAULT '{"enabled":false,"start":"06:00","end":"20:00","days":[1,2,3,4,5,6]}';
