import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Memberships and invite by email (FLEET_MEMBERSHIPS_CONTRACT.md): one
// account, many fleets, the fleet switcher, invitations, and what HR hears.
// The real routers, middleware and controllers over HTTP, with Prisma's
// models swapped for an in-memory store. The people start as the
// memberships migration leaves them (test/helpers/memoryModel.js
// migrateLegacyUsers mirrors the SQL), so the sign-in tests are also the
// "existing users sign in exactly as before" check.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to
// mail goes nowhere (a closed port): welcome emails fail quietly in the background
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1";
process.env.HR_INTEGRATION_ENABLED = "true";
delete process.env.PLATFORM_DECISIONS_ENABLED;

const { default: prisma } = await import("../lib/prisma.js");
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { default: userRoutes } = await import("../routes/userRoutes.js");
const { default: invitationRoutes } = await import("../routes/invitationRoutes.js");
const { default: alertRoutes } = await import("../routes/alertRoutes.js");
const { default: vehicleRoutes } = await import("../routes/vehicleRoutes.js");
const { invitationMailer, INVITE_DAYS } = await import("../controllers/invitationController.js");
const { memoryModel, membershipModels, migrateLegacyUsers } = await import("./helpers/memoryModel.js");

const PASSWORD = "correct horse battery";
let hash;
let db;
let mail;
let queued;

const LEGACY_USERS = [
  { id: "staff", role: "PLATFORM_ADMIN", companyId: null, email: "staff@figbloom.test", fullName: "Staff" },
  { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", email: "mike@a.test", fullName: "Mike" },
  { id: "owner-b", role: "COMPANY_OWNER", companyId: "co-b", email: "bea@b.test", fullName: "Bea" },
  { id: "admin-a", role: "ADMIN", companyId: "co-a", adminAccess: "dispatcher", email: "admin@a.test", fullName: "Ann" },
  { id: "driver-a", role: "DRIVER", companyId: "co-a", email: "dan@a.test", fullName: "Dan" },
  { id: "gone-a", role: "MECHANIC", companyId: "co-a", email: "gone@a.test", fullName: "Gone", status: "inactive" },
];

function reset() {
  const companies = [
    { id: "co-a", name: "Mike's Fleet", slug: "mikes-fleet", status: "active", subscriptionPlan: "pro", createdAt: new Date(0) },
    { id: "co-b", name: "Bea Transport", slug: "bea-transport", status: "active", subscriptionPlan: "pro", createdAt: new Date(0) },
    { id: "co-p", name: "Waiting Fleet", slug: "waiting-fleet", status: "pending", subscriptionPlan: "trial", createdAt: new Date(0) },
  ];
  const migrated = migrateLegacyUsers(
    LEGACY_USERS.map((u, i) => ({ ...u, passwordHash: hash, createdAt: new Date(1000 * (i + 1)) })),
    companies
  );
  db = {
    ...migrated,
    companies,
    invitations: [],
    teamAudit: [],
    refreshTokens: [],
    platformSettings: [{ id: "ps", requireManualApproval: false, defaultPlan: "trial", trialDays: 14, supportEmail: "support@figbloom.org", vehicleLimits: {}, createdAt: new Date(0) }],
    vehicles: [{ id: "veh-a", companyId: "co-a", plateNumber: "KAA 001A", status: "idle", driverId: null }],
    alerts: [{ id: "al-a", companyId: "co-a", vehicleId: "veh-a", type: "speeding", resolved: false, createdAt: new Date() }],
  };
  mail = [];
  queued = [];
}

const saved = {};
let server;
let baseUrl;

before(async () => {
  hash = await bcrypt.hash(PASSWORD, 4);
  for (const key of ["user", "company", "membership", "invitation", "teamAuditLog", "refreshToken", "platformSettings", "vehicle", "alert", "locationPing", "$transaction", "$executeRaw"]) {
    saved[key] = prisma[key];
  }
  saved.mailer = invitationMailer.send;
  const m = membershipModels(() => db);
  Object.assign(prisma, m);
  prisma.refreshToken = memoryModel(() => db.refreshTokens, { prefix: "rt", defaults: () => ({ revoked: false }) });
  prisma.platformSettings = memoryModel(() => db.platformSettings);
  prisma.vehicle = memoryModel(() => db.vehicles);
  prisma.alert = memoryModel(() => db.alerts);
  prisma.locationPing = { findFirst: async () => null };
  prisma.$transaction = async (fn) => fn(prisma);
  // the outboxes' raw INSERTs: [kind, localId, ...]
  prisma.$executeRaw = async (_strings, ...values) => {
    queued.push([values[0], values[1]]);
    return 1;
  };
  invitationMailer.send = async (to, details) => {
    mail.push({ to, ...details, token: details.inviteLink.split("/invite/")[1] });
  };

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/invitations", invitationRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/vehicles", vehicleRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  invitationMailer.send = saved.mailer;
  delete saved.mailer;
  Object.assign(prisma, saved);
  delete process.env.HR_INTEGRATION_ENABLED;
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

const login = (email, platform = "web", extra = {}) => call("POST", "/api/auth/login", { body: { email, password: PASSWORD, platform, ...extra } });
const tokenOf = async (email, platform = "web") => (await login(email, platform)).body.accessToken;
const membership = (userId, companyId) => db.memberships.find((m) => m.userId === userId && m.companyId === companyId);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// x is an Accountant in A and a Supervisor in B.
function addX({ lastUsed = "co-b" } = {}) {
  db.users.push({ id: "x", email: "x@acme.co.ke", fullName: "Xavier", passwordHash: hash, status: "active", isPlatformAdmin: false, createdAt: new Date() });
  db.memberships.push(
    { id: "mx-a", userId: "x", companyId: "co-a", role: "ACCOUNTANT", adminAccess: null, status: "active", lastUsedAt: lastUsed === "co-a" ? new Date(2) : new Date(1), createdAt: new Date(1) },
    { id: "mx-b", userId: "x", companyId: "co-b", role: "SUPERVISOR", adminAccess: null, status: "active", lastUsedAt: lastUsed === "co-b" ? new Date(2) : new Date(1), createdAt: new Date(2) }
  );
}

// ---- the migration and existing sign-ins

test("the migration gives every existing user one membership and staff isPlatformAdmin", () => {
  assert.deepEqual(
    db.memberships.map((m) => [m.userId, m.companyId, m.role, m.adminAccess, m.status]),
    [
      ["owner-a", "co-a", "COMPANY_OWNER", null, "active"],
      ["owner-b", "co-b", "COMPANY_OWNER", null, "active"],
      ["admin-a", "co-a", "ADMIN", "dispatcher", "active"],
      ["driver-a", "co-a", "DRIVER", null, "active"],
      ["gone-a", "co-a", "MECHANIC", null, "disabled"],
    ]
  );
  assert.equal(db.users.find((u) => u.id === "staff").isPlatformAdmin, true);
  assert.equal(db.memberships.some((m) => m.userId === "staff"), false);
});

test("existing users sign in exactly as before: same user fields, plus memberships[]", async () => {
  const web = await login("admin@a.test");
  assert.equal(web.status, 200);
  assert.deepEqual(
    { ...web.body.user, isPlatformAdmin: undefined, companyName: undefined },
    { id: "admin-a", email: "admin@a.test", fullName: "Ann", role: "ADMIN", companyId: "co-a", adminAccess: "dispatcher", isPlatformAdmin: undefined, companyName: undefined }
  );
  assert.ok(web.body.accessToken && web.body.refreshToken);
  assert.deepEqual(web.body.memberships.map((m) => [m.companyId, m.role, m.current]), [["co-a", "ADMIN", true]]);

  // the driver app
  const app = await login("dan@a.test", "mobile");
  assert.equal(app.status, 200);
  assert.equal(app.body.user.role, "DRIVER");
  assert.equal(app.body.user.companyId, "co-a");
  assert.equal(app.body.memberships.length, 1);
  assert.equal((await call("GET", "/api/vehicles/mine", { token: app.body.accessToken })).status, 200);

  // each app keeps its own people
  assert.equal((await login("dan@a.test", "web")).status, 403);
  assert.equal((await login("mike@a.test", "mobile")).status, 403);
  // staff
  const staff = await login("staff@figbloom.test");
  assert.equal(staff.body.user.role, "PLATFORM_ADMIN");
  assert.equal(staff.body.user.companyId, null);
  // a token issued before memberships ({ id, role, companyId }) still works
  const old = jwt.sign({ id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a" }, process.env.JWT_SECRET);
  const me = await call("GET", "/api/users/me", { token: old });
  assert.equal(me.status, 200);
  assert.equal(me.body.role, "COMPANY_OWNER");
  assert.equal(me.body.companyId, "co-a");
  // and a refresh token from before keeps the person in their fleet
  const oldRefresh = jwt.sign({ id: "owner-a" }, process.env.REFRESH_TOKEN_SECRET, { jwtid: "old" });
  db.refreshTokens.push({ id: "rt-old", userId: "owner-a", tokenHash: sha256(oldRefresh), revoked: false, expiresAt: new Date(Date.now() + 86400000) });
  const refreshed = await call("POST", "/api/auth/refresh", { body: { refreshToken: oldRefresh } });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.body.user.companyId, "co-a");
});

test("someone switched off before the migration can't sign in to that fleet", async () => {
  const app = await call("POST", "/api/auth/login", { body: { email: "gone@a.test", password: PASSWORD, platform: "mobile" } });
  assert.equal(app.status, 403);
  assert.equal(app.body.code, "no_fleet");
  // on the web: signed in to the plain "not part of any fleet" page, nothing else
  const web = await login("gone@a.test");
  assert.equal(web.status, 200);
  assert.equal(web.body.user.role, null);
  assert.deepEqual(web.body.memberships, []);
  const refused = await call("GET", "/api/users/me", { token: web.body.accessToken });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, "no_fleet");
});

// ---- several fleets: sign-in, switcher, staff roles

test("with several fleets: the last used one, the switcher list, and switching changes role and menus", async () => {
  addX({ lastUsed: "co-b" });
  const signIn = await login("x@acme.co.ke");
  assert.equal(signIn.body.user.companyId, "co-b");
  assert.equal(signIn.body.user.role, "SUPERVISOR");
  assert.deepEqual(signIn.body.memberships.map((m) => [m.companyName, m.roleTitle, m.current]), [["Bea Transport", "Supervisor", true], ["Mike's Fleet", "Accountant", false]]);

  // asking for a fleet at sign-in
  assert.equal((await login("x@acme.co.ke", "web", { companyId: "co-a" })).body.user.role, "ACCOUNTANT");

  const switched = await call("POST", "/api/auth/switch-fleet", { token: signIn.body.accessToken, body: { companyId: "co-a", refreshToken: signIn.body.refreshToken } });
  assert.equal(switched.status, 200);
  assert.equal(switched.body.user.companyId, "co-a");
  assert.equal(switched.body.user.role, "ACCOUNTANT");
  assert.ok(membership("x", "co-a").lastUsedAt > membership("x", "co-b").lastUsedAt, "remembered as the last used fleet");
  assert.equal(db.refreshTokens.find((t) => t.tokenHash === sha256(signIn.body.refreshToken)).revoked, true, "the replaced refresh token is revoked");
  const me = await call("GET", "/api/users/me", { token: switched.body.accessToken });
  assert.equal(me.body.role, "ACCOUNTANT");
  assert.equal(me.body.companyId, "co-a");

  // staff role allow lists follow the active membership: a supervisor closes alerts, an accountant can't
  db.alerts.push({ id: "al-b", companyId: "co-b", vehicleId: "veh-b", type: "speeding", resolved: false, createdAt: new Date() });
  assert.equal((await call("PATCH", "/api/alerts/al-a/resolve", { token: switched.body.accessToken })).status, 403);
  assert.equal((await call("PATCH", "/api/alerts/al-b/resolve", { token: signIn.body.accessToken })).status, 200);
  // and the fleet is the token's: B's session can't touch A's alert
  assert.equal((await call("PATCH", "/api/alerts/al-a/resolve", { token: signIn.body.accessToken })).status, 404);

  // the switcher's list
  const list = await call("GET", "/api/auth/memberships", { token: switched.body.accessToken });
  assert.deepEqual(list.body.memberships.map((m) => [m.companyId, m.current]), [["co-a", true], ["co-b", false]]);
});

test("switching is refused to a fleet you're not in, a driver fleet on the web, or a fleet not yet approved", async () => {
  addX();
  db.memberships.push(
    { id: "mx-d", userId: "x", companyId: "co-p", role: "COMPANY_OWNER", status: "active", createdAt: new Date(3) },
  );
  const token = await tokenOf("x@acme.co.ke");
  assert.equal((await call("POST", "/api/auth/switch-fleet", { token, body: { companyId: "nope" } })).status, 404);
  const pending = await call("POST", "/api/auth/switch-fleet", { token, body: { companyId: "co-p" } });
  assert.equal(pending.status, 403);
  assert.equal(pending.body.code, "company_pending");
  db.memberships.find((m) => m.id === "mx-d").role = "DRIVER";
  db.companies.find((c) => c.id === "co-p").status = "active";
  assert.equal((await call("POST", "/api/auth/switch-fleet", { token, body: { companyId: "co-p" } })).body.code, "wrong_app");
});

test("disabling someone in one fleet signs them out of that fleet only", async () => {
  addX({ lastUsed: "co-a" });
  const signIn = await login("x@acme.co.ke");
  assert.equal(signIn.body.user.companyId, "co-a");
  const owner = await tokenOf("mike@a.test");
  assert.equal((await call("PATCH", "/api/users/x/status", { token: owner, body: { status: "inactive" } })).status, 200);
  assert.equal(membership("x", "co-a").status, "disabled");
  assert.equal(membership("x", "co-b").status, "active");
  assert.deepEqual(db.teamAudit.map((a) => [a.action, a.targetUserId]), [["membership_disabled", "x"]]);

  // A's session ends at the next request
  const refused = await call("GET", "/api/users/me", { token: signIn.body.accessToken });
  assert.equal(refused.status, 401);
  assert.equal(refused.body.code, "account_inactive");
  // the refresh token isn't revoked (they still have B) and moves them to B
  const refreshed = await call("POST", "/api/auth/refresh", { body: { refreshToken: signIn.body.refreshToken } });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.body.user.companyId, "co-b");
  assert.deepEqual(refreshed.body.memberships.map((m) => m.companyId), ["co-b"]);
  // switching back to A is refused; signing in lands in B
  assert.equal((await call("POST", "/api/auth/switch-fleet", { token: refreshed.body.accessToken, body: { companyId: "co-a" } })).status, 404);
  assert.equal((await login("x@acme.co.ke")).body.user.companyId, "co-b");
  // B's owner can't touch A's membership, and A can switch them back on
  const ownerB = await tokenOf("bea@b.test");
  assert.equal((await call("PATCH", "/api/users/x/status", { token: ownerB, body: { status: "active" } })).status, 200, "B's own membership (already on)");
  assert.equal(membership("x", "co-a").status, "disabled");
  await call("PATCH", "/api/users/x/status", { token: owner, body: { status: "active" } });
  assert.equal(membership("x", "co-a").status, "active");
  // HR heard about A's membership each time, never B's
  assert.deepEqual(queued.filter(([kind]) => kind === "staff").map(([, key]) => key), ["x:co-a", "x:co-a"]);
});

// ---- invitations

async function invite(body, as = "mike@a.test", companyId) {
  const token = (await login(as, "web", companyId ? { companyId } : {})).body.accessToken;
  return call("POST", "/api/invitations", { token, body });
}

test("invite a new person: email with a one-time link, a password of their own, straight into the fleet", async () => {
  const res = await invite({ email: " New.Person@Acme.co.ke ", role: "ACCOUNTANT" });
  assert.equal(res.status, 201);
  assert.equal(res.body.emailed, true);
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, "new.person@acme.co.ke");
  assert.equal(mail[0].companyName, "Mike's Fleet");
  assert.equal(mail[0].roleTitle, "Accountant");
  assert.equal(mail[0].validDays, INVITE_DAYS);
  // only the token's sha256 is kept; the token is 32 random bytes
  const token = mail[0].token;
  assert.equal(Buffer.from(token, "base64url").length, 32);
  const stored = db.invitations[0];
  assert.equal(stored.tokenHash, sha256(token));
  assert.ok(!JSON.stringify(stored).includes(token));
  assert.ok(Math.abs(new Date(stored.expiresAt) - Date.now() - 7 * 86400000) < 60000);
  assert.deepEqual(db.teamAudit.map((a) => a.action), ["invited"]);

  const view = await call("GET", `/api/invitations/token/${token}`);
  assert.deepEqual([view.body.state, view.body.companyName, view.body.roleTitle, view.body.accountExists, view.body.invitedByName], ["open", "Mike's Fleet", "Accountant", false, "Mike"]);

  assert.equal((await call("POST", `/api/invitations/token/${token}/accept`, { body: { fullName: "New Person", password: "short" } })).status, 400);
  const accepted = await call("POST", `/api/invitations/token/${token}/accept`, { body: { fullName: "New Person", phone: "+254700000001", password: "a long password" } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.user.role, "ACCOUNTANT");
  assert.equal(accepted.body.user.companyId, "co-a");
  assert.ok(accepted.body.accessToken);
  const user = db.users.find((u) => u.email === "new.person@acme.co.ke");
  assert.equal(user.phone, "+254700000001");
  assert.equal(membership(user.id, "co-a").role, "ACCOUNTANT");
  assert.deepEqual(queued.filter(([k]) => k === "staff").map(([, key]) => key), [`${user.id}:co-a`], "HR hears about the new membership");
  assert.deepEqual(db.teamAudit.map((a) => a.action), ["invited", "invitation_accepted"]);
  // they now sign in with their own password, into fleet A with the accountant menu
  const signIn = await call("POST", "/api/auth/login", { body: { email: "new.person@acme.co.ke", password: "a long password", platform: "web" } });
  assert.equal(signIn.body.user.role, "ACCOUNTANT");

  // single use
  const again = await call("POST", `/api/invitations/token/${token}/accept`, { body: { fullName: "X", password: "a long password" } });
  assert.equal(again.status, 410);
  assert.equal(again.body.state, "used");
});

test("invite someone who already has an account: sign in to join, or join while signed in; a wrong account is told so", async () => {
  addX();
  // A's owner invites Bea (the owner of fleet B) as a supervisor
  await invite({ email: "bea@b.test", role: "SUPERVISOR" });
  const token = mail[0].token;
  assert.equal((await call("GET", `/api/invitations/token/${token}`)).body.accountExists, true);
  // signed in as someone else
  const wrong = await call("POST", `/api/invitations/token/${token}/accept`, { token: await tokenOf("x@acme.co.ke") });
  assert.equal(wrong.status, 409);
  assert.equal(wrong.body.code, "wrong_account");
  assert.match(wrong.body.error, /x@acme\.co\.ke.*bea@b\.test/);
  // not signed in, wrong password
  assert.equal((await call("POST", `/api/invitations/token/${token}/accept`, { body: { password: "nope nope nope" } })).body.code, "bad_password");
  // not signed in, right password: joins and lands in A
  const joined = await call("POST", `/api/invitations/token/${token}/accept`, { body: { password: PASSWORD } });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.user.companyId, "co-a");
  assert.equal(joined.body.user.role, "SUPERVISOR");
  assert.deepEqual(joined.body.memberships.map((m) => m.companyId).sort(), ["co-a", "co-b"]);
  assert.equal(membership("owner-b", "co-b").role, "COMPANY_OWNER", "still the owner of her own fleet");

  // Bea last used A, where she is a supervisor: she can't invite from there
  assert.equal((await invite({ email: "x@acme.co.ke", role: "ADMIN" }, "bea@b.test")).status, 403);
  // joining while signed in: Bea (from her own fleet B) invites Mike as an admin
  await invite({ email: "mike@a.test", role: "ADMIN", adminAccess: "viewer" }, "bea@b.test", "co-b");
  assert.equal((await invite({ email: "mike@a.test", role: "ADMIN" }, "bea@b.test", "co-b")).status, 201, "re-inviting replaces the open one");
  const [first, second] = mail.slice(-2);
  const mike = await tokenOf("mike@a.test");
  assert.equal((await call("POST", `/api/invitations/token/${first.token}/accept`, { token: mike })).body.state, "revoked");
  const inB = await call("POST", `/api/invitations/token/${second.token}/accept`, { token: mike });
  assert.equal(inB.status, 200);
  assert.equal(inB.body.user.companyId, "co-b", "switched into the fleet just joined");
  assert.deepEqual([membership("owner-a", "co-b").role, membership("owner-a", "co-b").adminAccess], ["ADMIN", "full"]);
  assert.equal(membership("owner-a", "co-a").role, "COMPANY_OWNER");
  // someone already in the fleet isn't invited again
  assert.equal((await invite({ email: "x@acme.co.ke", role: "ADMIN" }, "bea@b.test", "co-b")).body.code, "already_member");
});

test("expired, revoked and unknown invitation links say so plainly", async () => {
  await invite({ email: "late@acme.co.ke", role: "MECHANIC" });
  await invite({ email: "cancelled@acme.co.ke", role: "MECHANIC" });
  const [late, cancelled] = mail;
  db.invitations.find((i) => i.email === "late@acme.co.ke").expiresAt = new Date(Date.now() - 1000);
  const expired = await call("GET", `/api/invitations/token/${late.token}`);
  assert.equal(expired.status, 410);
  assert.equal(expired.body.state, "expired");
  assert.equal(expired.body.companyName, "Mike's Fleet");
  assert.equal((await call("POST", `/api/invitations/token/${late.token}/accept`, { body: { fullName: "L", password: "a long password" } })).body.state, "expired");
  assert.equal(db.users.some((u) => u.email === "late@acme.co.ke"), false, "no account is made from a dead link");

  const owner = await tokenOf("mike@a.test");
  const pending = await call("GET", "/api/invitations", { token: owner });
  assert.deepEqual(pending.body.map((i) => [i.email, i.state]).sort(), [["cancelled@acme.co.ke", "open"], ["late@acme.co.ke", "expired"]]);
  const cancelledId = pending.body.find((i) => i.email === "cancelled@acme.co.ke").id;
  assert.equal((await call("POST", `/api/invitations/${cancelledId}/revoke`, { token: owner })).status, 200);
  assert.equal((await call("GET", `/api/invitations/token/${cancelled.token}`)).body.state, "revoked");
  assert.equal((await call("GET", "/api/invitations/token/not-a-real-token")).body.state, "invalid");

  // resend renews an expired one with a new link; the old link stops working
  const lateId = pending.body.find((i) => i.email === "late@acme.co.ke").id;
  const resent = await call("POST", `/api/invitations/${lateId}/resend`, { token: owner });
  assert.equal(resent.body.invitation.state, "open");
  const renewed = mail.at(-1).token;
  assert.notEqual(renewed, late.token);
  assert.equal((await call("GET", `/api/invitations/token/${late.token}`)).body.state, "invalid");
  assert.equal((await call("GET", `/api/invitations/token/${renewed}`)).body.state, "open");
  assert.deepEqual(db.teamAudit.map((a) => a.action), ["invited", "invited", "invitation_revoked", "invitation_resent"]);
});

test("only the owner and full admins invite, never as owner, and not someone already in the fleet", async () => {
  assert.equal((await invite({ email: "a@acme.co.ke", role: "OPERATOR" }, "admin@a.test")).status, 403, "a dispatcher admin can't");
  assert.equal((await invite({ email: "a@acme.co.ke", role: "COMPANY_OWNER" })).status, 400);
  assert.equal((await invite({ email: "not an email", role: "OPERATOR" })).status, 400);
  assert.equal((await invite({ email: "dan@a.test", role: "OPERATOR" })).body.code, "already_member");
  assert.equal((await invite({ email: "gone@a.test", role: "OPERATOR" })).body.code, "member_disabled");
  // another fleet's owner can't see or cancel A's invitations
  await invite({ email: "a@acme.co.ke", role: "OPERATOR" });
  const id = db.invitations[0].id;
  assert.equal((await call("POST", `/api/invitations/${id}/revoke`, { token: await tokenOf("bea@b.test") })).status, 404);
  // a driver invite: joins, and is pointed to the app (no web session)
  await invite({ email: "newdriver@acme.co.ke", role: "DRIVER" });
  const driverJoin = await call("POST", `/api/invitations/token/${mail.at(-1).token}/accept`, { body: { fullName: "Newdriver", password: "a long password" } });
  assert.equal(driverJoin.body.joined, true);
  assert.equal(driverJoin.body.accessToken, undefined);
  assert.match(driverJoin.body.message, /app/);
});

// ---- registering, and a new fleet from the switcher

test("registering with an email that has an account asks them to sign in first", async () => {
  const res = await call("POST", "/api/auth/register-company", { body: { ownerName: "Mike", email: "MIKE@a.test", password: PASSWORD, companyName: "Second" } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "account_exists");
  assert.match(res.body.error, /Sign in first/);
});

test("anyone signed in starts a new fleet from the switcher: owner membership, outbox, switched in once active", async () => {
  // auto-approval: active straight away, switched in
  const driverOwner = await login("dan@a.test", "mobile");
  const fromApp = await call("POST", "/api/auth/fleets", { token: driverOwner.body.accessToken, body: { companyName: "Dan's Matatus" } });
  assert.equal(fromApp.status, 201);
  assert.equal(fromApp.body.accessToken, undefined, "the driver app gets no owner session; the web does");
  const dansFleet = db.companies.find((c) => c.name === "Dan's Matatus");
  assert.equal(membership("driver-a", dansFleet.id).role, "COMPANY_OWNER");
  assert.equal(membership("driver-a", "co-a").role, "DRIVER", "still a driver in Mike's fleet");

  const admin = await login("admin@a.test");
  const made = await call("POST", "/api/auth/fleets", { token: admin.body.accessToken, body: { companyName: "Ann's Vans", industry: "logistics_courier" } });
  assert.equal(made.status, 201);
  assert.equal(made.body.company.status, "active");
  assert.equal(made.body.user.role, "COMPANY_OWNER");
  assert.equal(made.body.user.companyId, made.body.company._id);
  assert.deepEqual(made.body.memberships.map((m) => m.companyName).sort(), ["Ann's Vans", "Mike's Fleet"]);
  assert.ok(queued.some(([kind, id]) => kind === "company" && id === made.body.company._id), "registered by the platform outbox");

  // console approval: pending, no switch; switched in once approved
  db.platformSettings[0].requireManualApproval = true;
  const staff = await login("staff@figbloom.test");
  const waiting = await call("POST", "/api/auth/fleets", { token: staff.body.accessToken, body: { companyName: "Staff Side Project" } });
  assert.equal(waiting.status, 201);
  assert.equal(waiting.body.company.status, "pending");
  assert.equal(waiting.body.accessToken, undefined);
  assert.equal(waiting.body.approval, "manual");
  const pendingId = waiting.body.company._id;
  assert.equal((await call("POST", "/api/auth/switch-fleet", { token: staff.body.accessToken, body: { companyId: pendingId } })).body.code, "company_pending");
  const listed = await call("GET", "/api/auth/memberships", { token: staff.body.accessToken });
  assert.deepEqual(listed.body.memberships.map((m) => [m.companyName, m.companyStatus]), [["Staff Side Project", "pending"]]);
  db.companies.find((c) => c.id === pendingId).status = "active";
  const inIt = await call("POST", "/api/auth/switch-fleet", { token: staff.body.accessToken, body: { companyId: pendingId } });
  assert.equal(inIt.status, 200);
  assert.equal(inIt.body.user.role, "COMPANY_OWNER");
  // and back to the staff area
  const back = await call("POST", "/api/auth/switch-fleet", { token: inIt.body.accessToken, body: { staffArea: true } });
  assert.equal(back.body.user.role, "PLATFORM_ADMIN");
  assert.equal((await call("POST", "/api/auth/switch-fleet", { token: inIt.body.accessToken, body: { staffArea: true } })).status, 200);
  assert.equal((await call("POST", "/api/auth/switch-fleet", { token: admin.body.accessToken, body: { staffArea: true } })).status, 403);

  // someone in no fleet can start one too
  const nobody = await login("gone@a.test");
  const fresh = await call("POST", "/api/auth/fleets", { token: nobody.body.accessToken, body: { companyName: "" } });
  assert.equal(fresh.status, 201);
  assert.equal(fresh.body.company.name, "Gone's Fleet");
});
