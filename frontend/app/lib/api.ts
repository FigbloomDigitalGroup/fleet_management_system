import { emitSessionExpired } from "./sessionEvents";
import { OFFLINE_MESSAGE, UNREACHABLE_MESSAGE, friendlyStatusMessage, isOffline, notifyError, notifySuccess } from "./notify";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
  // The popup shown when a POST/PUT/PATCH/DELETE succeeds; false for none.
  // Left out, it's the server's own `message` or one worked out from the path.
  successMessage?: string | false;
}

// Refresh tokens are single-use and rotate on every call. Pages here fire
// several API calls in parallel (e.g. the dashboards' Promise.all loads), so
// if the access token happens to expire right as a batch fires, every one of
// those calls would hit a 401 at the same moment — and without this dedup,
// each would independently redeem the SAME still-valid refresh token. The
// first succeeds and rotates it; every other concurrent attempt then arrives
// with an already-used token, which the server treats as reuse of a revoked
// token and responds to by revoking the entire session. Sharing one in-flight
// promise means concurrent callers all await the same single network call
// and get the same new token, instead of racing each other into a forced
// logout.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;

      const data = await res.json();
      localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      return data.accessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// Every failed request shows its message in a popup (ErrorPopups) as well as
// throwing it, so callers no longer need to log errors to the console. The
// session-expired case is left to SessionExpiredModal instead.
function failed(message: string, status?: number): Error {
  notifyError(message, popupTitle(status));
  // Marks it as already shown, so ErrorPopups doesn't show it twice if a
  // caller leaves it uncaught.
  return Object.assign(new Error(message), { notified: true });
}

// Requests whose success needs no popup: signing in has its own welcome,
// the rest happen in the background or are followed by a save that shows one.
const QUIET_SUCCESS = ["/api/auth/login", "/api/auth/logout", "/api/auth/refresh", "/api/agent/ask", "/api/messages", "/api/uploads"];

const RESOURCE_NAMES: Record<string, string> = {
  vehicles: "Vehicle",
  geofences: "Geofence",
  routes: "Route",
  jobs: "Job",
  maintenance: "Maintenance record",
  alerts: "Alert",
  users: "User",
  admins: "Admin",
  companies: "Company",
  settings: "Settings",
  billing: "Plan",
};

const ACTION_MESSAGES: [RegExp, string][] = [
  [/\/resolve$/, "Alert resolved."],
  [/\/complete$/, "Maintenance marked as done."],
  [/\/bulk-import$/, "Import finished."],
  [/\/optimize$/, "Route order optimised."],
  [/\/appearance$/, "Appearance saved."],
  [/\/access$/, "Access updated."],
  [/\/status$/, "Status updated."],
  [/\/plan$/, "Plan updated."],
  [/\/scan-now$/, "Scan started."],
  [/\/register-company$/, "Your company account has been created."],
];

function successText(method: string, path: string): string {
  const clean = path.split("?")[0];
  const action = ACTION_MESSAGES.find(([pattern]) => pattern.test(clean));
  if (action) return action[1];
  const segment = clean.replace(/^\/api\//, "").split("/").find((part) => RESOURCE_NAMES[part]);
  const name = segment ? RESOURCE_NAMES[segment] : null;
  const verb = method === "POST" ? "added" : method === "DELETE" ? "deleted" : "updated";
  if (name === "Settings") return method === "DELETE" ? "Settings reset." : "Settings saved.";
  return name ? `${name} ${verb}.` : "Saved successfully.";
}

function popupTitle(status?: number): string {
  if (status === undefined) return "Connection problem";
  if (status >= 500) return "Server problem";
  return "Couldn't complete that";
}

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {},
  isRetry = false
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  // FormData bodies (file uploads) must NOT get an explicit Content-Type —
  // the browser sets its own multipart boundary only when we leave it unset.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const { successMessage, ...init } = options;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw failed(isOffline() ? OFFLINE_MESSAGE : UNREACHABLE_MESSAGE);
  }

  // Token expired or missing — try refreshing once, then retry the request
  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, options, true);
    }

    // Only treat this as a session timeout if the user was actually signed
    // in (had a token to begin with). Otherwise this 401 is just a plain
    // auth failure on a public endpoint (e.g. wrong password on /login) —
    // let it fall through and surface the server's own error message.
    if (token) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      emitSessionExpired();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw failed(friendlyStatusMessage(res.status, data.error), res.status);
  }

  // Changes (not plain loads, which would pop up on every page and poll)
  // confirm themselves in a popup.
  const method = (init.method || "GET").toUpperCase();
  const quiet = QUIET_SUCCESS.some((p) => path.startsWith(p));
  if (method !== "GET" && successMessage !== false && !quiet) {
    notifySuccess(successMessage || data.message || successText(method, path));
  }

  return data as T;
}

// File downloads (e.g. the Excel report) need the same Bearer token and
// one-shot refresh as apiRequest, but the body is a binary blob, not JSON —
// so the browser can't just follow a plain link to it.
export async function apiDownload(path: string, fallbackFilename: string, isRetry = false): Promise<void> {
  const token = localStorage.getItem("accessToken");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw failed(isOffline() ? OFFLINE_MESSAGE : UNREACHABLE_MESSAGE);
  }

  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiDownload(path, fallbackFilename, true);
    if (token) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      emitSessionExpired();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw failed(friendlyStatusMessage(res.status, data.error), res.status);
  }

  // Prefer the server's filename (Content-Disposition) when CORS exposes it.
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackFilename;

  const blob = await res.blob();
  notifySuccess(`${filename} is downloading.`, "Download started");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// For `catch (err)` blocks — the thrown value is `unknown` in TypeScript.
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
