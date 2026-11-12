// Figbloom platform settings (FLEET_PLATFORM_CONTRACT.md section 2), read
// from the environment each time so a test (or a restart with new settings)
// sees the current value.

// PLATFORM_DECISIONS_ENABLED: once on, company approval, rejection,
// suspension and reactivation are decided in the Figbloom console only. The
// platform's decision webhook applies them, and Fleet's own /platform
// approve/suspend is refused.
export function platformDecisionsEnabled(env = process.env) {
  return /^(1|true|yes|on)$/i.test(String(env.PLATFORM_DECISIONS_ENABLED ?? "").trim());
}

// Where Figbloom staff decide (shown on Fleet's own company page).
export function platformConsoleUrl(env = process.env) {
  return String(env.PLATFORM_CONSOLE_URL || "https://console.figbloom.org").trim().replace(/\/+$/, "");
}

export const DECIDED_IN_CONSOLE = "Company approval and suspension are decided in the Figbloom console";

// The 409 Fleet's own approve/suspend answers while decisions are on.
export function decidedInConsoleBody(env = process.env) {
  return { error: `${DECIDED_IN_CONSOLE}.`, code: "decided_in_console", consoleUrl: platformConsoleUrl(env) };
}

// HR_INTEGRATION_ENABLED (FLEET_HR_CONTRACT.md section 3), off by default:
// Figbloom HR for Fleet companies. On: team members and drivers are sent to
// HR (fleet.staff.*), HR's events (hr.employee.left, hr.leave.*) are applied,
// and the HR & Payroll and My HR pages show. Off: nothing is queued, HR's
// events are answered 503 (the platform keeps them and retries), and the
// pages are hidden.
export function hrIntegrationEnabled(env = process.env) {
  return /^(1|true|yes|on)$/i.test(String(env.HR_INTEGRATION_ENABLED ?? "").trim());
}

// HR_MY_HR_URL: Figbloom HR's My HR API, e.g.
// https://hr.figbloom.org/api/integrations/my-hr (https, no trailing slash);
// null when unset or not https.
export function hrMyHrUrl(env = process.env) {
  const raw = String(env.HR_MY_HR_URL ?? "").trim();
  if (!raw) return null;
  try {
    if (new URL(raw).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return raw.replace(/\/+$/, "");
}
