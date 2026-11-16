// Signing in through Figbloom's Cognito pools (ERP/FLEET_COGNITO_CONTRACT.md
// section 2). The web dashboard sends the person to the pool's hosted login
// (authorization code + PKCE); its callback page hands the code to
// POST /api/auth/cognito/exchange, which uses this to swap the code for
// tokens (with the app client's secret) and verify the ID token. Fleet then
// issues its own session exactly as a password sign-in does.
//
// Two pools:
//   customers  every customer user of every Figbloom product
//   staff      Figbloom employees (MFA required); never a customer
//
// Settings (backend):
//   COGNITO_SIGN_IN              "on" switches the web dashboard over; anything else leaves it on passwords
//   COGNITO_REGION               e.g. eu-west-1
//   COGNITO_CUSTOMERS_POOL_ID, COGNITO_CUSTOMERS_DOMAIN, FLEET_WEB_CLIENT_ID, FLEET_WEB_CLIENT_SECRET
//   COGNITO_STAFF_POOL_ID, COGNITO_STAFF_DOMAIN, FLEET_STAFF_CLIENT_ID, FLEET_STAFF_CLIENT_SECRET
// A *_DOMAIN is the hosted login's address, e.g. https://figbloom-staging.auth.eu-west-1.amazoncognito.com
import crypto from "crypto";
import jwt from "jsonwebtoken";

export const POOLS = ["customers", "staff"];
const TIMEOUT_MS = 10_000;
const JWKS_TTL_MS = 6 * 60 * 60 * 1000;

export class CognitoError extends Error {
  // status: what Fleet answers the browser with
  constructor(message, status = 401, code = "sign_in_failed") {
    super(message);
    this.name = "CognitoError";
    this.status = status;
    this.code = code;
  }
}

export function cognitoSignInEnabled(env = process.env) {
  return String(env.COGNITO_SIGN_IN ?? "").trim().toLowerCase() === "on";
}

// One pool's settings, or null if any is missing.
export function poolConfig(pool, env = process.env) {
  const names =
    pool === "staff"
      ? ["COGNITO_STAFF_POOL_ID", "COGNITO_STAFF_DOMAIN", "FLEET_STAFF_CLIENT_ID", "FLEET_STAFF_CLIENT_SECRET"]
      : ["COGNITO_CUSTOMERS_POOL_ID", "COGNITO_CUSTOMERS_DOMAIN", "FLEET_WEB_CLIENT_ID", "FLEET_WEB_CLIENT_SECRET"];
  const region = env.COGNITO_REGION?.trim();
  const [poolId, domain, clientId, clientSecret] = names.map((n) => env[n]?.trim());
  if (!region || !poolId || !domain || !clientId || !clientSecret) return null;
  return {
    pool,
    clientId,
    clientSecret,
    tokenUrl: `${domain.replace(/\/+$/, "")}/oauth2/token`,
    issuer: `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
  };
}

async function send(url, init, fetchFn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal, redirect: "error" });
  } catch (err) {
    const why = controller.signal.aborted ? "timed out" : err?.message || String(err);
    throw new CognitoError(`Figbloom sign-in could not be reached (${why}).`, 502, "sign_in_unreachable");
  } finally {
    clearTimeout(timer);
  }
}

// The public keys a pool signs its tokens with, cached by issuer.
const jwksCache = new Map();
async function signingKey(issuer, kid, fetchFn, now) {
  let entry = jwksCache.get(issuer);
  // an unknown kid may be a key Cognito has just rotated in: fetch again once
  if (!entry || now() - entry.at > JWKS_TTL_MS || !entry.keys.has(kid)) {
    const res = await send(`${issuer}/.well-known/jwks.json`, {}, fetchFn);
    if (!res.ok) throw new CognitoError("Figbloom sign-in's keys could not be read.", 502, "sign_in_unreachable");
    const { keys = [] } = await res.json();
    entry = { at: now(), keys: new Map(keys.filter((k) => k.kid && k.kty === "RSA").map((k) => [k.kid, crypto.createPublicKey({ key: k, format: "jwk" })])) };
    jwksCache.set(issuer, entry);
  }
  const key = entry.keys.get(kid);
  if (!key) throw new CognitoError("This sign-in wasn't signed by Figbloom.");
  return key;
}

// The real thing. Tests swap these methods (like invitationMailer.send).
export const cognito = {
  fetch: (...args) => globalThis.fetch(...args),
  now: () => Date.now(),

  // code (+ its PKCE verifier) -> the ID token's verified claims
  async signIn(config, { code, codeVerifier, redirectUri }) {
    const idToken = await this.exchangeCode(config, { code, codeVerifier, redirectUri });
    return this.verifyIdToken(config, idToken);
  },

  async exchangeCode(config, { code, codeVerifier, redirectUri }) {
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const res = await send(
      config.tokenUrl,
      {
        method: "POST",
        headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        }).toString(),
      },
      this.fetch
    );
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not JSON */
    }
    if (!res.ok || typeof data?.id_token !== "string") {
      // invalid_grant: the code was used, expired, or isn't for this client and address
      throw new CognitoError("That sign-in has expired. Please sign in again.", 401, data?.error === "invalid_grant" ? "sign_in_expired" : "sign_in_failed");
    }
    return data.id_token;
  },

  async verifyIdToken(config, idToken) {
    const header = jwt.decode(idToken, { complete: true })?.header;
    if (!header?.kid || header.alg !== "RS256") throw new CognitoError("This sign-in wasn't signed by Figbloom.");
    const key = await signingKey(config.issuer, header.kid, this.fetch, this.now);
    let claims;
    try {
      claims = jwt.verify(idToken, key, {
        algorithms: ["RS256"],
        issuer: config.issuer,
        audience: config.clientId,
        clockTimestamp: Math.floor(this.now() / 1000),
      });
    } catch {
      throw new CognitoError("This sign-in couldn't be checked. Please sign in again.");
    }
    if (claims.token_use !== "id" || typeof claims.sub !== "string") throw new CognitoError("This sign-in couldn't be checked. Please sign in again.");
    return {
      sub: claims.sub,
      email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null,
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: typeof claims.name === "string" ? claims.name.trim() : null,
    };
  },
};

// Only for tests: forget cached keys.
export function clearSigningKeys() {
  jwksCache.clear();
}
