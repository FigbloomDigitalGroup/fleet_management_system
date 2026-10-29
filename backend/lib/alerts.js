import prisma from "./prisma.js";
import { getCompanySettings } from "./companySettings.js";
import { sendAlertEmail } from "./mailer.js";

export const ALERT_TYPE_LABELS = {
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
};

const DEFAULT_DEBOUNCE_MINUTES = 2;

// The single way automatic alerts are created. Skips types the company has
// disabled, suppresses repeats of the same type/vehicle (within
// `debounceMinutes`, or since `since` when given — e.g. the start of an idle
// streak), stamps `at` as the alert time so buffered offline pings don't all
// look like they happened on upload, and emails the company's chosen
// recipients for the types they opted into. Never throws: an alert failing
// to send must not break location ingestion.
export async function raiseAlert({ companyId, vehicleId, type, message, debounceMinutes, since, at }) {
  try {
    const settings = await getCompanySettings(companyId);
    if (settings.alertSettings.disabledTypes.includes(type)) return null;

    const createdAfter = since ?? new Date((at ?? new Date()).getTime() - (debounceMinutes ?? DEFAULT_DEBOUNCE_MINUTES) * 60000);
    if (debounceMinutes !== 0) {
      const recent = await prisma.alert.findFirst({
        where: { vehicleId: String(vehicleId), type, createdAt: { gte: createdAfter } },
        select: { id: true },
      });
      if (recent) return null;
    }

    const alert = await prisma.alert.create({
      data: { companyId: String(companyId), vehicleId: String(vehicleId), type, message, ...(at ? { createdAt: at } : {}) },
    });

    const { emailTypes, emailRecipientIds } = settings.alertSettings;
    if (emailTypes.includes(type) && emailRecipientIds.length) {
      const [recipients, vehicle] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: emailRecipientIds.map(String) }, companyId: String(companyId) },
          select: { email: true },
        }),
        prisma.vehicle.findUnique({ where: { id: String(vehicleId) }, select: { plateNumber: true } }),
      ]);
      sendAlertEmail(
        recipients.map((r) => r.email),
        { companyName: settings.companyName, plateNumber: vehicle?.plateNumber, typeLabel: ALERT_TYPE_LABELS[type] || type, message }
      ).catch((err) => console.error("[alerts] email failed:", err.message));
    }
    return alert;
  } catch (err) {
    console.error(`[alerts] failed to raise ${type}:`, err);
    return null;
  }
}
