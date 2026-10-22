export type Role = "PLATFORM_ADMIN" | "COMPANY_OWNER" | "ADMIN" | "DRIVER";

// Only meaningful for ADMIN users — null/undefined for every other role.
// Older stored sessions predate the field, so treat a missing value as "full".
export type AdminAccess = "full" | "dispatcher" | "viewer";

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: Role;
  companyId: string | null;
  adminAccess?: AdminAccess | null;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CompanyRecord {
  _id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "pending";
  subscriptionPlan: string;
  paymentMethod?: "mpesa" | "paystack" | null;
  totalRevenue?: number;
  industry?: string;
  createdAt: string;
  userCount?: number;
  dailyStartPoint?: {
    lat: number;
    lng: number;
    geofenceId?: string;
    updatedAt?: string;
  } | null;
}

export interface TransactionRecord {
  _id: string;
  companyId: { _id: string; name: string } | string;
  plan: "basic" | "pro";
  reference: string;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed" | "abandoned";
  channel: "card" | "mobile_money" | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ExpenseRecord {
  _id: string;
  companyId: string;
  vehicleId: { _id: string; plateNumber: string } | string;
  driverId: { _id: string; fullName: string } | string | null;
  category: "fuel" | "toll" | "parking" | "repair" | "other";
  amount: number;
  note: string | null;
  receiptUrl?: string | null;
  incurredAt: string;
  createdAt: string;
}

export interface CompanyStats {
  totalDistanceKm: number;
  estimatedExpenses: number | null;
  totalRevenue: number;
  vehicleCount: number;
  vehicleTypeBreakdown?: Record<string, number>;
  monthsSinceJoining: number;
}

export interface DailyStatPoint {
  date: string;
  distanceKm: number;
  fuelConsumedLiters: number;
}

export interface AdminRecord {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  adminAccess?: AdminAccess;
  createdAt: string;
}

export interface VehicleRecord {
  _id: string;
  plateNumber: string;
  make?: string;
  model?: string;
  deviceId?: string;
  vehicleType?: string;
  status: "active" | "idle" | "offline" | "maintenance";
  driverId?: { _id: string; fullName: string; email: string } | null;
  startGeofenceId?: { _id: string; name: string } | null;
  avgConsumptionLPer100Km?: number;
  odometerBaseKm?: number;
  createdAt: string;
}

export interface DriverRecord {
  _id: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
  phone?: string | null;
  dob?: string | null;
  nationalId?: string | null;
  address?: string | null;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
}

export interface TripRecord {
  _id: string;
  vehicleId: { _id: string; plateNumber: string; avgConsumptionLPer100Km?: number } | null;
  driverId: { _id: string; fullName: string } | null;
  startTime: string;
  endTime?: string;
  distanceKm?: number;
  // Set by the driver from the mobile app.
  purpose?: "business" | "private" | null;
  note?: string;
  endedBy?: "auto" | "driver" | null;
}

export interface AlertRecord {
  _id: string;
  vehicleId: { _id: string; plateNumber: string } | null;
  type: string;
  message: string;
  resolved: boolean;
  createdAt: string;
}


export interface RouteRecord {
  _id: string;
  vehicleId: { _id: string; plateNumber: string } | string;
  name: string;
  waypoints: { lat: number; lng: number }[];
  toleranceMeters: number;
  speedLimitKph: number | null;
  active: boolean;
  frequency: "daily" | "weekly";
  daysOfWeek: number[];
  source: "manual" | "ai";
  scheduledToday: boolean;
  completedToday: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface GeofenceRecord {
  _id: string;
  name: string;
  type: "circle" | "polygon";
  centerLat?: number;
  centerLng?: number;
  radiusM?: number;
  polygon?: { lat: number; lng: number }[];
  createdAt: string;
}

export interface AgentScanDetail {
  vehicleId: string;
  plateNumber: string;
  anomaly: boolean;
  reason: string;
}

export interface AgentScanLogRecord {
  _id: string;
  runAt: string;
  vehiclesScanned: number;
  anomaliesFound: number;
  status: "success" | "failed";
  errorMessage: string | null;
  details: AgentScanDetail[];
}

export interface AgentFinding {
  runAt: string;
  vehicleId: string;
  plateNumber: string;
  anomaly: boolean;
  reason: string;
}

export interface AgentDailyActivity {
  date: string;
  label: string;
  vehicleChecks: number;
  anomalies: number;
}

export interface AgentSummary {
  lastScanAt: string | null;
  lastScanStatus: "success" | "failed" | null;
  scansCoveringFleet: number;
  vehicleChecksLogged: number;
  anomaliesFound: number;
  recentFindings: AgentFinding[];
  dailyActivity: AgentDailyActivity[];
}


// ---- Jobs & deliveries ----

export type JobStatus = "assigned" | "started" | "arrived" | "completed" | "failed" | "cancelled";

export interface JobProof {
  photoUploadIds: string[];
  photoUrls: string[];
  signatureUploadId: string | null;
  signatureUrl: string | null;
  recipientName: string | null;
  notes: string | null;
  scannedCode: string | null;
  latitude?: number;
  longitude?: number;
  capturedAt: string;
}

export interface JobRecord {
  _id: string;
  companyId: string;
  driverId: { _id: string; fullName: string } | null;
  vehicleId: { _id: string; plateNumber: string } | null;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  scheduledDate: string;
  windowStart: string | null;
  windowEnd: string | null;
  sequence: number;
  status: JobStatus;
  failureReason: string | null;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  proof: JobProof | null;
  trackingToken: string;
  trackingPath: string;
  late: boolean;
  createdAt: string;
}

export interface OptimizeResult {
  jobs: JobRecord[];
  distanceKm: number;
  lateMinutes: number;
  estimatedFinishAt?: string;
  startedFrom?: "vehicle_location" | "first_stop";
}

export interface PublicTracking {
  companyName: string | null;
  title: string;
  address: string;
  destination: { latitude: number; longitude: number };
  status: JobStatus;
  windowStart: string | null;
  windowEnd: string | null;
  driverFirstName: string | null;
  plateNumber: string | null;
  driverLocation: { latitude: number; longitude: number; recordedAt: string } | null;
  etaMinutes: number | null;
  distanceRemainingKm: number | null;
  completedAt: string | null;
  failureReason: string | null;
  updatedAt: string;
}

// ---- Messages ----

export interface MessageRecord {
  _id: string;
  driverId: string;
  senderId: string;
  fromDriver: boolean;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface MessageThread {
  driverId: string;
  driverName: string;
  lastMessage: { body: string; fromDriver: boolean; createdAt: string } | null;
  unread: number;
}

// ---- Driver scores ----

export interface DriverScore {
  driverId: string;
  score: number | null;
  grade: "Excellent" | "Good" | "Fair" | "Needs coaching" | null;
  periodDays: number;
  distanceKm: number;
  trips: number;
  events: {
    speeding: number;
    harsh_braking: number;
    harsh_acceleration: number;
    harsh_cornering: number;
    phone_use: number;
  };
  totalEvents: number;
  minDistanceKm: number;
  fullName?: string;
  email?: string;
}

// ---- Inspections ----

export interface InspectionRecord {
  _id: string;
  vehicleId: { _id: string; plateNumber: string } | null;
  driverId?: { _id: string; fullName: string } | null;
  items: { key: string; label: string; ok: boolean; note?: string | null; photoUploadId?: string | null; photoUrl?: string | null }[];
  passed: boolean;
  odometerKm?: number | null;
  notes?: string | null;
  createdAt: string;
}

// ---- Maintenance ----

export interface MaintenanceItem {
  _id: string;
  vehicleId: { _id: string; plateNumber: string } | null;
  kind: "record" | "reminder";
  title: string;
  notes: string | null;
  performedAt: string | null;
  odometerKm: number | null;
  costKes: number | null;
  dueDate: string | null;
  dueOdometerKm: number | null;
  intervalDays: number | null;
  intervalKm: number | null;
  status: "open" | "done";
  state: null | "upcoming" | "due_soon" | "overdue";
  createdAt: string;
}

// ---- Tracking: device status & history ----

export interface DeviceStatus {
  lastSeenAt: string | null;
  batteryLevel: number | null;
  isCharging: boolean | null;
  locationEnabled: boolean | null;
  permission: "background" | "foreground" | "denied" | null;
  appState: "active" | "background" | null;
  isSharing: boolean | null;
  platform: string | null;
  appVersion: string | null;
}

export interface LiveVehicleRecord {
  vehicleId: string;
  plateNumber: string;
  status: string;
  vehicleType?: string;
  driverId?: string | null;
  device: DeviceStatus | null;
  lastLocation: {
    latitude: number;
    longitude: number;
    recordedAt: string;
    isMocked?: boolean;
    accuracyM?: number | null;
    source?: string;
  } | null;
}

export interface HistoryPoint {
  latitude: number;
  longitude: number;
  speedKph: number | null;
  heading: number | null;
  recordedAt: string;
  isMocked: boolean;
}

export interface HistoryStop {
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
}

export interface LocationHistory {
  vehicleId: string;
  plateNumber: string;
  from: string;
  to: string;
  truncated: boolean;
  points: HistoryPoint[];
  stops: HistoryStop[];
  idleMinutes: number;
  movingMinutes: number;
  distanceKm: number;
}

// ---- Reports ----

export interface ReportRow {
  id: string;
  name: string;
  trips: number;
  distanceKm: number;
  drivingHours: number;
  idleMinutes: number;
  stops: number;
  jobsCompleted: number;
  jobsLate: number;
  jobsFailed: number;
  expensesKes: number;
  inspections: number;
  inspectionsFailed: number;
  score: number | null;
}

export interface ReportSummary {
  from: string;
  to: string;
  groupBy: "vehicle" | "driver";
  rows: ReportRow[];
  totals: Partial<Omit<ReportRow, "id" | "name">>;
}

// ---- Company settings ----

export interface AlertSettings {
  speedLimitKph: number;
  idleMinutes: number;
  offlineMinutes: number;
  lowBatteryPercent: number;
  harshBrakingKphPerSec: number;
  harshAccelerationKphPerSec: number;
  disabledTypes: string[];
  emailRecipientIds: string[];
  emailTypes: string[];
}

export interface TrackingHours {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
}

export interface CompanySettings {
  alertSettings: AlertSettings;
  trackingHours: TrackingHours;
  dataRetentionDays: number;
  alertTypes: { key: string; label: string }[];
  possibleRecipients: { id: string; fullName: string; email: string; role: string }[];
}
