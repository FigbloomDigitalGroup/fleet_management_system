export type Role = "PLATFORM_ADMIN" | "COMPANY_OWNER" | "ADMIN" | "DRIVER";

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: Role;
  companyId: string | null;
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
  createdAt: string;
  userCount?: number;
  dailyStartPoint?: {
    lat: number;
    lng: number;
    geofenceId?: string;
    updatedAt?: string;
  } | null;
}

export interface AdminRecord {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface VehicleRecord {
  _id: string;
  plateNumber: string;
  make?: string;
  model?: string;
  deviceId?: string;
  status: "active" | "idle" | "offline" | "maintenance";
  driverId?: { _id: string; fullName: string; email: string } | null;
  startGeofenceId?: { _id: string; name: string } | null;
  createdAt: string;
}

export interface DriverRecord {
  _id: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface TripRecord {
  _id: string;
  vehicleId: { _id: string; plateNumber: string } | null;
  driverId: { _id: string; fullName: string } | null;
  startTime: string;
  endTime?: string;
  distanceKm?: number;
}

export interface AlertRecord {
  _id: string;
  vehicleId: { _id: string; plateNumber: string } | null;
  type: string;
  message: string;
  resolved: boolean;
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

