// Shapes returned by /api/reports/* (see backend reportDetailsController).

export interface Metric {
  value: number | null;
  /** % change vs the previous period of the same length (points for the score). */
  change: number | null;
}

export interface ReportOverview {
  metrics: {
    distanceKm: Metric;
    expensesKes: Metric & { fuelKes: number };
    trips: Metric;
    avgScore: Metric & { grade: string | null };
  };
  daily: { date: string; distanceKm: number; trips: number; expensesKes: number; fuelKes: number }[];
  scoreBands: Record<string, number>;
  topDrivers: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    score: number | null;
    grade: string | null;
    distanceKm: number;
    trips: number;
  }[];
  driverCount: number;
}

export interface FuelReport {
  rows: {
    id: string;
    name: string;
    distanceKm: number;
    ratedLPer100Km: number | null;
    estimatedLiters: number | null;
    fuelKes: number;
    fills: number;
    kesPerKm: number | null;
  }[];
  totals: { distanceKm: number; estimatedLiters: number; fuelKes: number; fills: number; kesPerKm: number | null };
}

export type SafetyKey = "speeding" | "harsh_braking" | "harsh_acceleration" | "harsh_cornering" | "phone_use";

export interface SafetyReport {
  groupBy: "vehicle" | "driver";
  rows: ({ id: string; name: string; topSpeedKph: number | null; total: number } & Record<SafetyKey, number>)[];
  totals: { topSpeedKph: number | null; total: number } & Record<SafetyKey, number>;
  alertsByType: { type: string; count: number }[];
  speeding: { id: string; recordedAt: string; vehicle: string; driver: string; speedKph: number | null }[];
}

export interface GeofenceReport {
  visits: {
    id: string;
    geofence: string;
    vehicle: string;
    driver: string;
    enteredAt: string | null;
    exitedAt: string | null;
    minutesInside: number | null;
  }[];
  zones: { geofence: string; entries: number; exits: number; vehicles: number }[];
  totals: { entries: number; exits: number };
  recordedSince: string | null;
}

export interface MaintenanceReport {
  rows: {
    id: string;
    vehicle: string;
    title: string;
    state: "overdue" | "due_soon" | "upcoming";
    dueDate: string | null;
    daysLeft: number | null;
    dueOdometerKm: number | null;
    odometerKm: number;
    kmLeft: number | null;
  }[];
  totals: { overdue: number; dueSoon: number; upcoming: number; servicedInRange: number; serviceCostKes: number };
}

export interface TripsReport {
  rows: {
    id: string;
    vehicle: string;
    driver: string;
    startTime: string;
    endTime: string | null;
    minutes: number | null;
    distanceKm: number | null;
    avgSpeedKph: number | null;
    purpose: string | null;
  }[];
  truncated: boolean;
  totals: { trips: number; distanceKm: number; minutes: number };
}
