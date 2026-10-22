import Company from "../models/Company.js";

export const ALERT_SETTING_DEFAULTS = {
  speedLimitKph: 80,
  idleMinutes: 10,
  offlineMinutes: 15,
  lowBatteryPercent: 15,
  harshBrakingKphPerSec: 8,
  harshAccelerationKphPerSec: 6,
  disabledTypes: [],
  emailRecipientIds: [],
  emailTypes: [],
};

export const TRACKING_HOURS_DEFAULTS = { enabled: false, start: "06:00", end: "20:00", days: [1, 2, 3, 4, 5, 6] };
export const DATA_RETENTION_DEFAULT_DAYS = 180;
export const TRACKING_TIMEZONE = "Africa/Nairobi";

// Companies created before these settings existed have no subdocument at
// all, so every reader goes through here to get a complete object.
export function resolveSettings(company) {
  const alert = { ...ALERT_SETTING_DEFAULTS, ...(company?.alertSettings?.toObject?.() ?? company?.alertSettings ?? {}) };
  const hours = { ...TRACKING_HOURS_DEFAULTS, ...(company?.trackingHours?.toObject?.() ?? company?.trackingHours ?? {}) };
  return {
    alertSettings: alert,
    trackingHours: hours,
    dataRetentionDays: company?.dataRetentionDays ?? DATA_RETENTION_DEFAULT_DAYS,
  };
}

// Short-lived cache — the ping endpoint reads settings on every location
// update, and a company's thresholds change rarely.
const cache = new Map();
const CACHE_MS = 30 * 1000;

export async function getCompanySettings(companyId) {
  const key = String(companyId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const company = await Company.findById(companyId).select("alertSettings trackingHours dataRetentionDays name");
  const value = { ...resolveSettings(company), companyName: company?.name ?? "" };
  cache.set(key, { value, expires: Date.now() + CACHE_MS });
  return value;
}

export function invalidateCompanySettings(companyId) {
  cache.delete(String(companyId));
}

// Is `date` inside the company's tracking hours? Always true when the
// feature is off. Evaluated in Nairobi time regardless of server timezone.
export function isWithinTrackingHours(trackingHours, date = new Date()) {
  if (!trackingHours?.enabled) return true;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TRACKING_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const toMin = (hhmm) => {
    const [h, m] = String(hhmm).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  if (!trackingHours.days.includes(day)) return false;
  const start = toMin(trackingHours.start);
  const end = toMin(trackingHours.end);
  // Overnight windows (e.g. 22:00–06:00) wrap past midnight.
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
