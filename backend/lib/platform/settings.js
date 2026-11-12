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
