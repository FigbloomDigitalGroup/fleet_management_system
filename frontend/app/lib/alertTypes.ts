import { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiBatteryCharging,
  FiCpu,
  FiDroplet,
  FiLogIn,
  FiLogOut,
  FiMapPin,
  FiMessageSquare,
  FiNavigation,
  FiPackage,
  FiPauseCircle,
  FiSmartphone,
  FiTool,
  FiWifiOff,
  FiXCircle,
  FiZap,
  FiClipboard,
  FiCornerUpRight,
  FiTrendingDown,
  FiTrendingUp,
  FiShield,
  FiSlash,
  FiBluetooth,
  FiTruck,
} from "react-icons/fi";

// Mirrors ALERT_TYPE_LABELS in backend/lib/alerts.js — kept here so every
// place that renders an alert type (list, toasts, settings) says the same
// thing instead of the raw snake_case key.
export const ALERT_TYPE_LABELS: Record<string, string> = {
  speeding: "Speeding",
  geofence_entry: "Geofence entry",
  geofence_exit: "Geofence exit",
  unauthorized_movement: "Unauthorized movement",
  device_offline: "Device offline",
  maintenance_due: "Maintenance due",
  route_deviation: "Route deviation",
  fuel_anomaly: "Fuel anomaly",
  ai_pattern_anomaly: "AI pattern anomaly",
  sos: "SOS",
  harsh_braking: "Harsh braking",
  harsh_acceleration: "Harsh acceleration",
  harsh_cornering: "Harsh cornering",
  phone_use: "Phone use while driving",
  excessive_idling: "Excessive idling",
  mock_location: "Fake GPS detected",
  location_disabled: "Location turned off",
  low_battery: "Low phone battery",
  tracking_stopped: "Tracking stopped",
  app_logout: "Driver logged out",
  inspection_failed: "Inspection failed",
  job_failed: "Job failed",
  phone_left_vehicle: "Phone left vehicle",
  wrong_vehicle: "Phone in another vehicle",
  admin_message: "Message to driver",
};

const ALERT_TYPE_ICONS: Record<string, IconType> = {
  speeding: FiZap,
  geofence_entry: FiLogIn,
  geofence_exit: FiLogOut,
  unauthorized_movement: FiShield,
  device_offline: FiWifiOff,
  maintenance_due: FiTool,
  route_deviation: FiNavigation,
  fuel_anomaly: FiDroplet,
  ai_pattern_anomaly: FiCpu,
  sos: FiAlertTriangle,
  harsh_braking: FiTrendingDown,
  harsh_acceleration: FiTrendingUp,
  harsh_cornering: FiCornerUpRight,
  phone_use: FiSmartphone,
  excessive_idling: FiPauseCircle,
  mock_location: FiMapPin,
  location_disabled: FiSlash,
  low_battery: FiBatteryCharging,
  tracking_stopped: FiXCircle,
  app_logout: FiLogOut,
  inspection_failed: FiClipboard,
  job_failed: FiPackage,
  phone_left_vehicle: FiBluetooth,
  wrong_vehicle: FiTruck,
  admin_message: FiMessageSquare,
};

export function alertTypeLabel(type: string): string {
  return ALERT_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

export function alertTypeIcon(type: string): IconType {
  return ALERT_TYPE_ICONS[type] ?? FiAlertTriangle;
}

// Types worth a red accent rather than the default orange.
const CRITICAL_TYPES = new Set(["sos", "mock_location", "unauthorized_movement", "job_failed", "inspection_failed", "phone_left_vehicle", "wrong_vehicle"]);

export function isCriticalAlert(type: string): boolean {
  return CRITICAL_TYPES.has(type);
}
