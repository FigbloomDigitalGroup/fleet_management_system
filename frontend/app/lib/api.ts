import { emitSessionExpired } from "./sessionEvents";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function refreshAccessToken(): Promise<string | null> {
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
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {},
  isRetry = false
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
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