import { emitSessionExpired } from "./sessionEvents";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
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

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {},
  isRetry = false
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  // FormData bodies (file uploads) must NOT get an explicit Content-Type —
  // the browser sets its own multipart boundary only when we leave it unset.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Unable to reach the API at ${API_URL}. Start the backend and check NEXT_PUBLIC_API_URL.`
    );
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
    throw new Error(data.error || "Something went wrong");
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
    throw new Error(`Unable to reach the API at ${API_URL}.`);
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
    throw new Error(data.error || "Download failed");
  }

  // Prefer the server's filename (Content-Disposition) when CORS exposes it.
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackFilename;

  const blob = await res.blob();
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
