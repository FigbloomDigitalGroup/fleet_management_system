import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Figbloom sign-in (ERP/FLEET_COGNITO_CONTRACT.md section 2): the real routers,
// middleware and controllers over HTTP, Prisma's models in memory, and a
// stand-in for Cognito that signs real RS256 ID tokens. So the token checks
// (signature, issuer, audience, expiry, token_use) run for real.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1";
delete process.env.HR_INTEGRATION_ENABLED;
delete process.env.PLATFORM_DECISIONS_ENABLED;

const REGION = "eu-west-1";
const POOL = { customers: "eu-west-1_Cust", staff: "eu-west-1_Staff" };
const CLIENT = { customers: "fleet-web-client", staff: "fleet-staff-client" };
const DOMAIN = { customers: "https://figbloom-test.auth.eu-west-1.amazoncognito.com", staff: "https://figbloom-staff-test.auth.eu-west-1.amazoncognito.com" };
const issuer = (pool) => `https://cognito-idp.${REGION}.amazonaws.com/${POOL[pool]}`;
const SETTINGS = {
  COGNITO_REGION: REGION,
  COGNITO_CUSTOMERS_POOL_ID: POOL.customers,
  COGNITO_CUSTOMERS_DOMAIN: DOMAIN.customers,
  FLEET_WEB_CLIENT_ID: CLIENT.customers,
  FLEET_WEB_CLIENT_SECRET: "web-secret",
  COGNITO_STAFF_POOL_ID: POOL.staff,
  COGNITO_STAFF_DOMAIN: DOMAIN.staff,
  FLEET_STAFF_CLIENT_ID: CLIENT.staff,
  FLEET_STAFF_CLIENT_SECRET: "staff-secret",
};
Object.assign(process.env, SETTINGS);

const { default: prisma } = await import("../lib/prisma.js");
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { authenticate } = await import("../middleware/auth.js");
const { cognito, clearSigningKeys } = await import("../lib/cognito.js");
const { memoryModel, membershipModels, migrateLegacyUsers } = await import("./helpers/memoryModel.js");

const PASSWORD = "correct horse battery";
const VERIFIER = "v".repeat(43);
const REDIRECT = "https://fleet-staging.figbloom.org/auth/callback";
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-key";
const otherKey = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;

let hash;
let db;
// code -> what Cognito's token endpoint answers for it
let codes;
let tokenRequests;

function reset() {
  const companies = [{ id: "co-a", name: "Mike's Fleet", slug: "mikes-fleet", status: "active", subscriptionPlan: "pro", createdAt: new Date(0) }];
  const migrated = migrateLegacyUsers(
    [
      { id: "staff", role: "PLATFORM_ADMIN", companyId: null, email: "staff@figbloom.test", fullName: "Staff" },
      { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", email: "mike@a.test", fullName: "Mike" },
      { id: "driver-a", role: "DRIVER", companyId: "co-a", email: "dan@a.test", fullName: "Dan" },
    ].map((u, i) => ({ ...u, passwordHash: hash, createdAt: new Date(1000 * (i + 1)) })),
    companies
  );
  db = {
    ...migrated,
    companies,
    refreshTokens: [],
  };
  codes = new Map();
  tokenRequests = [];
  process.env.COGNITO_SIGN_IN = "on";
  clearSigningKeys();
}

// An ID token as the pool would issue it; `over` changes claims, `opts` the signing
function idToken(pool, claims, { key = privateKey, kid = KID, over = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sub: crypto.randomUUID(), token_use: "id", email_verified: true, iss: issuer(pool), aud: CLIENT[pool], iat: now, exp: now + 3600, ...claims, ...over },
    key,
    { algorithm: "RS256", keyid: kid }
  );
}

// Cognito hands out `code` for this token
function cognitoWillAnswer(code, token) {
  codes.set(code, token);
  return code;
}

async function fakeCognito(url, init = {}) {
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url.endsWith("/.well-known/jwks.json")) {
    return json(200, { keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" }] });
  }
  if (url.endsWith("/oauth2/token")) {
    const form = new URLSearchParams(init.body);
    tokenRequests.push({ url, authorization: init.headers.authorization, form: Object.fromEntries(form) });
    const token = codes.get(form.get("code"));
    codes.delete(form.get("code")); // single use, as Cognito
    return token ? json(200, { id_token: token, access_token: "a", token_type: "Bearer" }) : json(400, { error: "invalid_grant" });
  }
  return json(404, {});
}

const saved = {};
let server;
let baseUrl;

before(async () => {
  hash = await bcrypt.hash(PASSWORD, 4);
  for (const key of ["user", "company", "membership", "refreshToken", "$transaction"]) saved[key] = prisma[key];
  saved.fetch = cognito.fetch;
  Object.assign(prisma, membershipModels(() => db));
  prisma.refreshToken = memoryModel(() => db.refreshTokens, { prefix: "rt", defaults: () => ({ revoked: false }) });
  prisma.$transaction = async (fn) => fn(prisma);
  cognito.fetch = fakeCognito;

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  // who a fleet route sees the request as (the real middleware)
  app.get("/whoami", authenticate, (req, res) => res.json(req.user));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  cognito.fetch = saved.fetch;
  delete saved.fetch;
  Object.assign(prisma, saved);
  delete process.env.COGNITO_SIGN_IN;
  for (const key of Object.keys(SETTINGS)) delete process.env[key];
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(reset);

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const exchange = (pool, code, extra = {}) =>
  call("POST", "/api/auth/cognito/exchange", { body: { pool, code, codeVerifier: VERIFIER, redirectUri: REDIRECT, ...extra } });
const signIn = (pool, claims, opts) => exchange(pool, cognitoWillAnswer(crypto.randomUUID(), idToken(pool, claims, opts)));
const user = (email) => db.users.find((u) => u.email === email);
const claimsOf = (accessToken) => jwt.decode(accessToken);

// ---- the switch

test("with the switch off, the web keeps passwords and the exchange isn't there", async () => {
  process.env.COGNITO_SIGN_IN = "off";
  const r = await call("POST", "/api/auth/login", { body: { email: "mike@a.test", password: PASSWORD, platform: "web" } });
  assert.equal(r.status, 200);
  assert.equal(claimsOf(r.body.accessToken).via, "password");
  assert.equal((await signIn("customers", { email: "mike@a.test" })).status, 404);
});

test("with the switch on, the web's password sign-in is gone and the driver app's stays", async () => {
  const web = await call("POST", "/api/auth/login", { body: { email: "mike@a.test", password: PASSWORD, platform: "web" } });
  assert.equal(web.status, 410);
  assert.equal(web.body.code, "use_figbloom_sign_in");
  // no platform at all is treated as the web
  assert.equal((await call("POST", "/api/auth/login", { body: { email: "mike@a.test", password: PASSWORD } })).status, 410);
  const app = await call("POST", "/api/auth/login", { body: { email: "dan@a.test", password: PASSWORD, platform: "mobile" } });
  assert.equal(app.status, 200);
  assert.equal(app.body.user.role, "DRIVER");
});

// ---- customers pool

test("a Fleet user signs in with their Figbloom account: linked by verified email, then by sub", async () => {
  const sub = crypto.randomUUID();
  const r = await signIn("customers", { sub, email: "Mike@A.test" });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "COMPANY_OWNER");
  assert.equal(r.body.user.companyId, "co-a");
  assert.equal(claimsOf(r.body.accessToken).via, "customers");
  assert.equal(user("mike@a.test").identitySub, sub);

  // linked now: a changed email in Cognito still finds them
  const again = await signIn("customers", { sub, email: "mike.new@a.test" });
  assert.equal(again.status, 200);
  assert.equal(again.body.user.id, "owner-a");

  // and the session works on the fleet's routes
  const me = await call("GET", "/whoami", { token: r.body.accessToken });
  assert.equal(me.status, 200);
  assert.deepEqual({ role: me.body.role, companyId: me.body.companyId, isPlatformAdmin: me.body.isPlatformAdmin }, { role: "COMPANY_OWNER", companyId: "co-a", isPlatformAdmin: false });
});

test("the code goes to Cognito with Fleet's client secret, the PKCE verifier and the callback address", async () => {
  await signIn("customers", { email: "mike@a.test" });
  const [req] = tokenRequests;
  assert.equal(req.url, `${DOMAIN.customers}/oauth2/token`);
  assert.equal(req.authorization, `Basic ${Buffer.from(`${CLIENT.customers}:web-secret`).toString("base64")}`);
  assert.deepEqual(
    { grant_type: req.form.grant_type, code_verifier: req.form.code_verifier, redirect_uri: req.form.redirect_uri, client_id: req.form.client_id },
    { grant_type: "authorization_code", code_verifier: VERIFIER, redirect_uri: REDIRECT, client_id: CLIENT.customers }
  );
});

test("someone new to Fleet gets a Fleet user with no fleets, and lands on 'no fleet'", async () => {
  const sub = crypto.randomUUID();
  const r = await signIn("customers", { sub, email: "wanjiru@hr-customer.test", name: "Wanjiru Kamau" });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, null);
  assert.equal(r.body.user.companyId, null);
  assert.deepEqual(r.body.memberships, []);
  assert.deepEqual({ fullName: user("wanjiru@hr-customer.test").fullName, identitySub: user("wanjiru@hr-customer.test").identitySub }, { fullName: "Wanjiru Kamau", identitySub: sub });
  // they can start a fleet from there
  const fleets = await call("GET", "/api/auth/memberships", { token: r.body.accessToken });
  assert.equal(fleets.status, 200);
});

test("an existing Fleet user is never handed over on an unverified email, or to a second Figbloom account", async () => {
  const unverified = await signIn("customers", { email: "mike@a.test", email_verified: false });
  assert.equal(unverified.status, 409);
  assert.equal(unverified.body.code, "email_in_use");
  assert.equal(user("mike@a.test").identitySub, undefined);

  await signIn("customers", { email: "mike@a.test" });
  const other = await signIn("customers", { email: "mike@a.test" }); // a different sub, same email
  assert.equal(other.status, 409);
  assert.equal(other.body.code, "email_in_use");
});

test("Figbloom staff signing in on the customers pool are customers: no staff area, not even after a refresh", async () => {
  const r = await signIn("customers", { email: "staff@figbloom.test" });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, null);
  assert.equal(r.body.user.isPlatformAdmin, false);
  assert.equal(claimsOf(r.body.accessToken).isPlatformAdmin, false);

  const refreshed = await call("POST", "/api/auth/refresh", { body: { refreshToken: r.body.refreshToken } });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.body.user.role, null);
  assert.equal(claimsOf(refreshed.body.accessToken).via, "customers");

  const staffArea = await call("POST", "/api/auth/switch-fleet", { token: refreshed.body.accessToken, body: { staffArea: true } });
  assert.equal(staffArea.status, 403);
  // and their no-fleet token is refused on fleet routes rather than read as staff
  const me = await call("GET", "/whoami", { token: r.body.accessToken });
  assert.equal(me.status, 403);
  assert.equal(me.body.code, "no_fleet");
});

test("a driver signing in on the web through Figbloom is sent to the app, as with a password", async () => {
  const r = await signIn("customers", { email: "dan@a.test" });
  assert.equal(r.status, 403);
  assert.match(r.body.error, /mobile app/i);
});

// ---- staff pool

test("Figbloom staff reach the staff area through the staff pool; nobody else does", async () => {
  const sub = crypto.randomUUID();
  const r = await signIn("staff", { sub, email: "staff@figbloom.test" });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "PLATFORM_ADMIN");
  assert.equal(claimsOf(r.body.accessToken).via, "staff");
  assert.equal(user("staff@figbloom.test").staffIdentitySub, sub);
  assert.equal(user("staff@figbloom.test").identitySub, undefined);

  const refreshed = await call("POST", "/api/auth/refresh", { body: { refreshToken: r.body.refreshToken } });
  assert.equal(refreshed.body.user.role, "PLATFORM_ADMIN");
  assert.equal((await call("GET", "/whoami", { token: refreshed.body.accessToken })).body.role, "PLATFORM_ADMIN");

  const notStaff = await signIn("staff", { email: "mike@a.test" });
  assert.equal(notStaff.status, 403);
  assert.equal(notStaff.body.code, "not_fleet_staff");
  assert.equal(user("mike@a.test").staffIdentitySub, undefined);
});

test("a staff-pool token is no good on the customers client, and the other way round", async () => {
  const staffToken = idToken("staff", { email: "staff@figbloom.test" });
  assert.equal((await exchange("customers", cognitoWillAnswer("c1", staffToken))).status, 401);
  const customerToken = idToken("customers", { email: "staff@figbloom.test" });
  assert.equal((await exchange("staff", cognitoWillAnswer("c2", customerToken))).status, 401);
});

// ---- the token itself

test("refuses tokens that aren't Figbloom's, aren't for Fleet, have run out or aren't ID tokens", async () => {
  const bad = [
    idToken("customers", { email: "mike@a.test" }, { key: otherKey }),
    idToken("customers", { email: "mike@a.test" }, { kid: "unknown-key" }),
    idToken("customers", { email: "mike@a.test" }, { over: { aud: "someone-elses-client" } }),
    idToken("customers", { email: "mike@a.test" }, { over: { iss: "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_Other" } }),
    idToken("customers", { email: "mike@a.test" }, { over: { exp: Math.floor(Date.now() / 1000) - 60 } }),
    idToken("customers", { email: "mike@a.test" }, { over: { token_use: "access" } }),
  ];
  for (const [i, token] of bad.entries()) {
    const r = await exchange("customers", cognitoWillAnswer(`bad-${i}`, token));
    assert.equal(r.status, 401, `token ${i}`);
  }
  assert.equal(user("mike@a.test").identitySub, undefined);
});

test("a used or unknown code says the sign-in expired", async () => {
  const code = cognitoWillAnswer("once", idToken("customers", { email: "mike@a.test" }));
  assert.equal((await exchange("customers", code)).status, 200);
  const reused = await exchange("customers", code);
  assert.equal(reused.status, 401);
  assert.equal(reused.body.code, "sign_in_expired");
});

test("checks what the callback page sends", async () => {
  assert.equal((await exchange("elsewhere", "c")).status, 400);
  assert.equal((await exchange("customers", "c", { codeVerifier: "short" })).status, 400);
  assert.equal((await exchange("customers", "")).status, 400);
  assert.equal((await exchange("customers", "c", { redirectUri: undefined })).status, 400);
});

test("says so plainly when a pool's settings are missing", async () => {
  const secret = process.env.FLEET_STAFF_CLIENT_SECRET;
  delete process.env.FLEET_STAFF_CLIENT_SECRET;
  try {
    const r = await signIn("staff", { email: "staff@figbloom.test" });
    assert.equal(r.status, 503);
    assert.equal(r.body.code, "cognito_not_configured");
  } finally {
    process.env.FLEET_STAFF_CLIENT_SECRET = secret;
  }
});
