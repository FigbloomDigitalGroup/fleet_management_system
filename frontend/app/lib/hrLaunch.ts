import { Role } from "../types/auth";

// Whether HR is there for the company (only for people who can open HR):
//   connected      open it (a new tab signs them in)
//   setting_up     switched on, HR is still creating the company
//   not_connected  not switched on: they can ask Figbloom for it
//   unknown        couldn't be checked: treated like connected, and the
//                  launch tab says what's wrong
export type HrConnection = "connected" | "setting_up" | "not_connected" | "unknown";

// HR is opened (the sidebar item and the card) when it's there, or when it
// couldn't be checked: the launch tab then shows the precise problem.
export function hrOpensDirectly(connection: HrConnection | null) {
  return connection === "connected" || connection === "unknown";
}

// Figbloom HR opens in a new tab (the /hr/launch page), so Fleet stays where
// it is. The launch page asks for the one-time sign-in link itself.
export const HR_LAUNCH_PATH = "/hr/launch";

// Call straight from the click handler (no await before it), so pop-up
// blockers let the tab open. If it's blocked anyway, this tab goes there
// (navigate: the router's push).
export function openHrLaunchTab(navigate: (path: string) => void) {
  const tab = window.open(HR_LAUNCH_PATH, "_blank");
  if (!tab) {
    navigate(HR_LAUNCH_PATH);
    return;
  }
  try {
    tab.opener = null;
  } catch {
    /* some browsers don't allow it; the page is our own anyway */
  }
}

// The area a role's HR & Payroll page lives in (the owner's /company, the
// admins' and staff roles' /admin).
export function hrAreaFor(role: Role | null | undefined): "/company" | "/admin" {
  return role === "COMPANY_OWNER" ? "/company" : "/admin";
}
