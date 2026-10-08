import { emitSessionExpired } from "./sessionEvents";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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