-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'COMPANY_OWNER', 'ADMIN', 'DRIVER');

-- CreateEnum
CREATE TYPE "AdminAccess" AS ENUM ('full', 'dispatcher', 'viewer');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('active', 'suspended', 'pending');

-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('logistics_courier', 'public_transport', 'school_transport', 'construction', 'taxi_ride_hailing', 'security_cash_transit', 'agriculture', 'government_municipal', 'oil_gas', 'rental_car', 'other');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('mpesa', 'paystack');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('car', 'van', 'truck', 'bus', 'motorcycle', 'tractor', 'excavator', 'crane', 'dump_truck', 'tanker', 'armored_vehicle', 'trailer');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('active', 'idle', 'offline', 'maintenance');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('speeding', 'geofence_entry', 'geofence_exit', 'unauthorized_movement', 'device_offline', 'maintenance_due', 'route_deviation', 'fuel_anomaly', 'ai_pattern_anomaly', 'sos', 'harsh_braking', 'harsh_acceleration', 'excessive_idling', 'admin_message', 'harsh_cornering', 'phone_use', 'mock_location', 'location_disabled', 'low_battery', 'tracking_stopped', 'app_logout', 'inspection_failed', 'job_failed');

-- CreateEnum
CREATE TYPE "DrivingEventType" AS ENUM ('speeding', 'harsh_braking', 'harsh_acceleration', 'harsh_cornering', 'phone_use');

-- CreateEnum
CREATE TYPE "DrivingEventSource" AS ENUM ('gps', 'sensor', 'app');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('fuel', 'toll', 'parking', 'repair', 'other');

-- CreateEnum
CREATE TYPE "GeofenceType" AS ENUM ('circle', 'polygon');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('assigned', 'started', 'arrived', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PingSource" AS ENUM ('device', 'driver_app', 'manual');

-- CreateEnum
CREATE TYPE "MaintenanceKind" AS ENUM ('record', 'reminder');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('open', 'done');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('trial', 'basic', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "PaidPlan" AS ENUM ('basic', 'pro');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'success', 'failed', 'abandoned');

-- CreateEnum
CREATE TYPE "TripPurpose" AS ENUM ('business', 'private');

-- CreateEnum
CREATE TYPE "TripEndedBy" AS ENUM ('auto', 'driver');

-- CreateEnum
CREATE TYPE "RouteFrequency" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "RouteSource" AS ENUM ('manual', 'ai');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('inspection', 'receipt', 'pod_photo', 'signature', 'avatar', 'logo');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'pending',
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'trial',
    "trialEndsAt" TIMESTAMP(3),
    "industry" "Industry" NOT NULL DEFAULT 'other',
    "paymentMethod" "PaymentMethod",
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyStartPoint" JSONB,
    "alertSettings" JSONB,
    "trackingHours" JSONB,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "logoUploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "companyId" TEXT,
    "adminAccess" "AdminAccess" NOT NULL DEFAULT 'full',
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "resetPasswordTokenHash" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "phone" TEXT,
    "dob" TEXT,
    "nationalId" TEXT,
    "address" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "avatarUploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "requireManualApproval" BOOLEAN NOT NULL DEFAULT true,
    "defaultPlan" "Plan" NOT NULL DEFAULT 'trial',
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "vehicleLimits" JSONB NOT NULL DEFAULT '{"trial":3,"basic":15,"pro":50,"enterprise":999}',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@getour.com',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "deviceId" TEXT,
    "trackerToken" TEXT,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'car',
    "status" "VehicleStatus" NOT NULL DEFAULT 'offline',
    "statusManuallySet" BOOLEAN NOT NULL DEFAULT false,
    "driverId" TEXT,
    "startGeofenceId" TEXT,
    "fuelCapacityLiters" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "avgConsumptionLPer100Km" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "odometerBaseKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "device" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speedKph" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "fuelLevelLiters" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "isMocked" BOOLEAN NOT NULL DEFAULT false,
    "source" "PingSource" NOT NULL DEFAULT 'manual',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "endLat" DOUBLE PRECISION,
    "endLng" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "purpose" "TripPurpose",
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "endedBy" "TripEndedBy",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrivingEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "type" "DrivingEventType" NOT NULL,
    "source" "DrivingEventSource" NOT NULL,
    "value" DOUBLE PRECISION,
    "speedKph" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrivingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "hiddenForDriverAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GeofenceType" NOT NULL,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radiusM" DOUBLE PRECISION,
    "polygon" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "waypoints" JSONB NOT NULL DEFAULT '[]',
    "toleranceMeters" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "speedLimitKph" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "RouteFrequency" NOT NULL DEFAULT 'daily',
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "source" "RouteSource" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteCompletion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "dateKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "scheduledDate" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'assigned',
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "proof" JSONB,
    "trackingToken" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "fromDriver" BOOLEAN NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "readAt" TIMESTAMP(3),
    "hiddenForDriverAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptUploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "passed" BOOLEAN NOT NULL,
    "odometerKm" DOUBLE PRECISION,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "performedAt" TIMESTAMP(3),
    "odometerKm" DOUBLE PRECISION,
    "costKes" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "dueOdometerKm" DOUBLE PRECISION,
    "intervalDays" INTEGER,
    "intervalKm" DOUBLE PRECISION,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "alertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plan" "PaidPlan" NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "channel" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentScanLog" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehiclesScanned" INTEGER NOT NULL DEFAULT 0,
    "anomaliesFound" INTEGER NOT NULL DEFAULT 0,
    "status" "ScanStatus" NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "details" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "AgentScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_deviceId_key" ON "Vehicle"("deviceId");

-- CreateIndex
CREATE INDEX "Vehicle_trackerToken_idx" ON "Vehicle"("trackerToken");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_companyId_plateNumber_key" ON "Vehicle"("companyId", "plateNumber");

-- CreateIndex
CREATE INDEX "LocationPing_vehicleId_recordedAt_idx" ON "LocationPing"("vehicleId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "Trip_vehicleId_startTime_idx" ON "Trip"("vehicleId", "startTime");

-- CreateIndex
CREATE INDEX "DrivingEvent_driverId_recordedAt_idx" ON "DrivingEvent"("driverId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "DrivingEvent_companyId_recordedAt_idx" ON "DrivingEvent"("companyId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_companyId_resolved_idx" ON "Alert"("companyId", "resolved");

-- CreateIndex
CREATE INDEX "Alert_resolvedAt_idx" ON "Alert"("resolvedAt");

-- CreateIndex
CREATE INDEX "Geofence_companyId_idx" ON "Geofence"("companyId");

-- CreateIndex
CREATE INDEX "Route_vehicleId_idx" ON "Route"("vehicleId");

-- CreateIndex
CREATE INDEX "RouteCompletion_routeId_dateKey_idx" ON "RouteCompletion"("routeId", "dateKey");

-- CreateIndex
CREATE INDEX "RouteCompletion_vehicleId_dateKey_idx" ON "RouteCompletion"("vehicleId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "Job_trackingToken_key" ON "Job"("trackingToken");

-- CreateIndex
CREATE INDEX "Job_companyId_scheduledDate_idx" ON "Job"("companyId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Job_driverId_status_sequence_idx" ON "Job"("driverId", "status", "sequence");

-- CreateIndex
CREATE INDEX "Message_driverId_createdAt_idx" ON "Message"("driverId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_companyId_createdAt_idx" ON "Message"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Expense_companyId_incurredAt_idx" ON "Expense"("companyId", "incurredAt" DESC);

-- CreateIndex
CREATE INDEX "Expense_vehicleId_incurredAt_idx" ON "Expense"("vehicleId", "incurredAt" DESC);

-- CreateIndex
CREATE INDEX "Inspection_companyId_createdAt_idx" ON "Inspection"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Inspection_vehicleId_createdAt_idx" ON "Inspection"("vehicleId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_kind_status_idx" ON "MaintenanceRecord"("vehicleId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_companyId_createdAt_idx" ON "Transaction"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentScanLog_runAt_idx" ON "AgentScanLog"("runAt" DESC);

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_logoUploadId_fkey" FOREIGN KEY ("logoUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarUploadId_fkey" FOREIGN KEY ("avatarUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_startGeofenceId_fkey" FOREIGN KEY ("startGeofenceId") REFERENCES "Geofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingEvent" ADD CONSTRAINT "DrivingEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingEvent" ADD CONSTRAINT "DrivingEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingEvent" ADD CONSTRAINT "DrivingEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Geofence" ADD CONSTRAINT "Geofence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteCompletion" ADD CONSTRAINT "RouteCompletion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteCompletion" ADD CONSTRAINT "RouteCompletion_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteCompletion" ADD CONSTRAINT "RouteCompletion_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteCompletion" ADD CONSTRAINT "RouteCompletion_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_receiptUploadId_fkey" FOREIGN KEY ("receiptUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
