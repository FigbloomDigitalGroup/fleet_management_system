// Signing in with a Figbloom account (ERP/FLEET_COGNITO_CONTRACT.md section 2).
// The dashboard sends the browser to Figbloom's sign-in page (Cognito managed
// login) with PKCE; it comes back to /auth/callback (customers) or
// /auth/staff/callback (Figbloom staff) with a code, which the API swaps for
// Fleet's own session (POST /api/auth/cognito/exchange). The code verifier and
// state live in sessionStorage for that round trip only.
//
// Settings (all public; none of them is a secret):
//   NEXT_PUBLIC_FIGBLOOM_SIGN_IN=on            the switch (with the API's COGNITO_SIGN_IN)
//   NEXT_PUBLIC_COGNITO_CUSTOMERS_DOMAIN       https://<prefix>.auth.eu-west-1.amazoncognito.com
//   NEXT_PUBLIC_FLEET_WEB_CLIENT_ID            the FleetWeb app client
//   NEXT_PUBLIC_COGNITO_STAFF_DOMAIN, NEXT_PUBLIC_FLEET_STAFF_CLIENT_ID   the same for staff

export type FigbloomPool = "customers" | "staff";

const STORAGE_KEY = "fleet:figbloom-sign-in";
const SCOPES = "openid email profile";

// Written out in full: Next only fills in NEXT_PUBLIC_* settings it can see by name.
const POOLS: Record<FigbloomPool, { domain?: string; clientId?: string; callback: string }> = {
  customers: {
    domain: process.env.NEXT_PUBLIC_COGNITO_CUSTOMERS_DOMAIN,
    clientId: process.env.NEXT_PUBLIC_FLEET_WEB_CLIENT_ID,
    callback: "/auth/callback",
  },
  staff: {
    domain: process.env.NEXT_PUBLIC_COGNITO_STAFF_DOMAIN,
    clientId: process.env.NEXT_PUBLIC_FLEET_STAFF_CLIENT_ID,
    callback: "/auth/staff/callback",
  },
};

// What a person reads when their password doesn't meet the Figbloom rule
// (the API and the platform say the same).
export const FIGBLOOM_PASSWORD_RULE = "at least 8 characters, with an upper-case letter, a lower-case letter, a digit and a symbol";

export function figbloomSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIGBLOOM_SIGN_IN === "on";
}

// null when the password is fine; otherwise what to fix.
export function figbloomPasswordProblem(password: string): string | null {
  const missing: string[] = [];
  if (password.length < 8) missing.push(`at least 8 characters (you've typed ${password.length})`);
  if (!/[A-Z]/.test(password)) missing.push("an upper-case letter");
  if (!/[a-z]/.test(password)) missing.push("a lower-case letter");
  if (!/\d/.test(password)) missing.push("a digit");
  if (!/[^A-Za-z0-9]/.test(password)) missing.push("a symbol");
  return missing.length ? `Your password needs ${missing.join(", ")}.` : null;
}

function config(pool: FigbloomPool) {
  const { domain, clientId, callback } = POOLS[pool];
  if (!domain || !clientId) return null;
  return { domain: domain.replace(/\/+$/, ""), clientId, redirectUri: `${window.location.origin}${callback}` };
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomString = (size: number) => base64url(crypto.getRandomValues(new Uint8Array(size)));

/**
 * Off to Figbloom's sign-in page. next: the page to land on afterwards
 * (checked again on the way back). Throws when the pool isn't set up here.
 */
export async function startFigbloomSignIn(pool: FigbloomPool, next?: string | null): Promise<void> {
  const c = config(pool);
  if (!c) throw new Error("Figbloom sign-in isn't set up on this site yet. Please contact Figbloom support.");
  const verifier = randomString(48); // 64 characters
  const state = randomString(24);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ pool, state, verifier, next: next ?? null }));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  // Figbloom's sign-in page is another site, not a page of this app
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${c.domain}/oauth2/authorize?${params}`);
}

export interface FigbloomReturn {
  pool: FigbloomPool;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  next: string | null;
}

/**
 * What came back to the callback page, checked against what was sent: the
 * exchange's body, or why not (a message to show). Single use.
 */
export function readFigbloomReturn(pool: FigbloomPool, query: URLSearchParams): FigbloomReturn | { error: string } {
  let saved: { pool?: string; state?: string; verifier?: string; next?: string | null } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  const cognitoError = query.get("error");
  if (cognitoError) {
    return { error: cognitoError === "access_denied" ? "Sign-in was cancelled." : "Figbloom couldn't sign you in. Please try again." };
  }
  const code = query.get("code");
  const c = config(pool);
  if (!code || !c || !saved?.verifier || saved.pool !== pool || !saved.state || saved.state !== query.get("state")) {
    // an old or copied link, or sign-in started in another tab
    return { error: "This sign-in link has expired. Please sign in again." };
  }
  return { pool, code, codeVerifier: saved.verifier, redirectUri: c.redirectUri, next: saved.next ?? null };
}

// The pool a Fleet session came from (its access token's `via`), if any.
export function sessionPool(accessToken: string | null): FigbloomPool | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.via === "customers" || payload.via === "staff" ? payload.via : null;
  } catch {
    return null;
  }
}

// Where to send the browser so Figbloom's sign-in ends too, or null.
export function figbloomLogoutUrl(pool: FigbloomPool): string | null {
  const c = config(pool);
  if (!c) return null;
  const params = new URLSearchParams({ client_id: c.clientId, logout_uri: `${window.location.origin}/login` });
  return `${c.domain}/logout?${params}`;
}
