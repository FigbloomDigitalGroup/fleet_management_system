import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Figbloom accounts made by Fleet (ERP/FLEET_COGNITO_CONTRACT.md section 2,
// "When COGNITO_SIGN_IN=on"): sign-up, the "Set your password" page,
// invitations, staff creating a fleet for a client, and the backfill. The
// real routers and controllers over HTTP, Prisma's models in memory, and the
// platform's POST /users stood in for by a fake directory.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1";
delete process.env.HR_INTEGRATION_ENABLED;
delete process.env.PLATFORM_DECISIONS_ENABLED;

const { default: prisma } = await import("../lib/prisma.js");
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { default: invitationRoutes } = await import("../routes/invitationRoutes.js");
const { default: supportRoutes } = await import("../routes/supportRoutes.js");
const { invitationMailer } = await import("../controllers/invitationController.js");
const { figbloomAccounts } = await import("../lib/figbloomAccounts.js");
const { PlatformError } = await import("../lib/platform/client.js");
const { backfillFigbloomAccounts } = await import("../lib/cognitoBackfill.js");
const { confirmEmailToken, confirmEmailLink } = await import("../lib/emailConfirm.js");
const { memoryModel, membershipModels, migrateLegacyUsers } = await import("./helpers/memoryModel.js");

const PASSWORD = "correct horse battery";
const STRONG = "Str0ng!Passw0rd";
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

let hash;
let db;
let mail;
// the platform's accounts: email -> { sub, password, createdByFleet }
let accounts;
let platformCalls;

// POST /users and POST /users/{sub}/initial-password, as the platform answers them
const fakeClient = {
  async createUser({ email, name, password, email_proven }) {
    platformCalls.push({ call: "createUser", email, name, password, email_proven });
    if (password !== undefined && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) {
      throw new PlatformError("weak", 400, "invalid_password");
    }
    const found = accounts.get(email);
    if (found) return { user_sub: found.sub, created: false };
    const sub = `sub-${accounts.size + 1}`;
    accounts.set(email, { sub, password: password ?? null, createdByFleet: true });
    return { user_sub: sub, created: true };
  },
  async setInitialPassword(sub, password, { emailProven = false } = {}) {
    platformCalls.push({ call: "setInitialPassword", sub, password, emailProven });
    const account = [...accounts.values()].find((a) => a.sub === sub);
    if (!account || !account.createdByFleet || account.password) throw new PlatformError("set", 409, "password_already_set");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) throw new PlatformError("weak", 400, "invalid_password");
    account.password = password;
    if (emailProven) account.emailVerified = true;
    return { ok: true };
  },
  async markEmailVerified(sub) {
    platformCalls.push({ call: "markEmailVerified", sub });
    const account = [...accounts.values()].find((a) => a.sub === sub);
    if (!account || !account.createdByFleet) throw new PlatformError("not yours", 403, "forbidden");
    account.emailVerified = true;
    return { user_sub: sub, email_verified: true };
  },
};

function reset() {
  const companies = [{ id: "co-a", name: "Mike's Fleet", slug: "mikes-fleet", status: "active", subscriptionPlan: "pro", createdAt: new Date(0) }];
  const migrated = migrateLegacyUsers(
    [
      { id: "staff", role: "PLATFORM_ADMIN", companyId: null, email: "staff@figbloom.test", fullName: "Staff" },
      { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", email: "mike@a.test", fullName: "Mike" },
      { id: "admin-a", role: "ADMIN", companyId: "co-a", email: "ann@a.test", fullName: "Ann" },
      { id: "driver-a", role: "DRIVER", companyId: "co-a", email: "dan@a.test", fullName: "Dan" },
    ].map((u, i) => ({ ...u, passwordHash: hash, identitySub: null, createdAt: new Date(1000 * (i + 1)) })),
    companies
  );
  db = {
    ...migrated,
    companies,
    invitations: [],
    teamAudit: [],
    refreshTokens: [],
    staffAuditLogs: [],
    platformSettings: [{ id: "ps", requireManualApproval: false, defaultPlan: "trial", trialDays: 14, supportEmail: "support@figbloom.org", vehicleLimits: {}, createdAt: new Date(0) }],
  };
  mail = [];
  accounts = new Map();
  platformCalls = [];
  process.env.COGNITO_SIGN_IN = "on";
}

const saved = {};
let server;
let baseUrl;

before(async () => {
  hash = await bcrypt.hash(PASSWORD, 4);
  for (const key of ["user", "company", "membership", "invitation", "teamAuditLog", "refreshToken", "platformSettings", "staffAuditLog", "$transaction", "$executeRaw"]) {
    saved[key] = prisma[key];
  }
  saved.mailer = invitationMailer.send;
  saved.client = figbloomAccounts.client;
  Object.assign(prisma, membershipModels(() => db));
  prisma.refreshToken = memoryModel(() => db.refreshTokens, { prefix: "rt", defaults: () => ({ revoked: false }) });
  prisma.platformSettings = memoryModel(() => db.platformSettings);
  prisma.staffAuditLog = memoryModel(() => db.staffAuditLogs);
  prisma.$transaction = async (fn) => fn(prisma);
  prisma.$executeRaw = async () => 1; // the outboxes
  invitationMailer.send = async (to, details) => {
    mail.push({ to, token: details.inviteLink.split("/invite/")[1] });
  };
  figbloomAccounts.client = () => fakeClient;

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/invitations", invitationRoutes);
  app.use("/api/support", supportRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  invitationMailer.send = saved.mailer;
  figbloomAccounts.client = saved.client;
  delete saved.mailer;
  delete saved.client;
  Object.assign(prisma, saved);
  delete process.env.COGNITO_SIGN_IN;
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

const viaOf = (accessToken) => jwt.decode(accessToken).via;
const userByEmail = (email) => db.users.find((u) => u.email === email);

// An invitation from Mike, made the way the Team page makes it (signed in
// while the switch is off), then the switch goes on.
async function invite(email, role = "ACCOUNTANT") {
  process.env.COGNITO_SIGN_IN = "off";
  const login = await call("POST", "/api/auth/login", { body: { email: "mike@a.test", password: PASSWORD, platform: "web" } });
  const res = await call("POST", "/api/invitations", { token: login.body.accessToken, body: { email, role } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  process.env.COGNITO_SIGN_IN = "on";
  return mail.at(-1).token;
}

// A "Set your password" link, as the welcome email holds one.
function resetLinkFor(userId) {
  const token = crypto.randomBytes(16).toString("hex");
  const user = db.users.find((u) => u.id === userId);
  user.resetPasswordTokenHash = sha256(token);
  user.resetPasswordExpires = new Date(Date.now() + 3600000);
  return { email: user.email, token };
}

// ---- sign-up

test("sign-up makes the Figbloom account with the password; Fleet keeps only a random one", async () => {
  const res = await call("POST", "/api/auth/register-company", { body: { ownerName: "Juma", email: "Juma@X.test", password: STRONG, companyName: "Juma Co" } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(platformCalls, [{ call: "createUser", email: "juma@x.test", name: "Juma", password: STRONG, email_proven: false }]);
  const user = userByEmail("juma@x.test");
  assert.equal(user.identitySub, "sub-1");
  assert.equal(await bcrypt.compare(STRONG, user.passwordHash), false, "Fleet never stores the Figbloom password");
  assert.equal(viaOf(res.body.accessToken), "customers");
});

test("sign-up with an email that has a Figbloom account: 409 figbloom_account_exists, nothing made in Fleet", async () => {
  accounts.set("juma@x.test", { sub: "sub-hr", password: "x", createdByFleet: false });
  const res = await call("POST", "/api/auth/register-company", { body: { ownerName: "Juma", email: "juma@x.test", password: STRONG } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "figbloom_account_exists");
  assert.equal(userByEmail("juma@x.test"), undefined);
  assert.equal(db.companies.length, 1);
});

test("sign-up: a password the pool refuses is a 400 with the rule; Fleet's 8 characters no longer apply", async () => {
  const weak = await call("POST", "/api/auth/register-company", { body: { ownerName: "Juma", email: "juma@x.test", password: "longbutweak" } });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.code, "invalid_password");
  assert.match(weak.body.error, /12 characters/);
  assert.equal(userByEmail("juma@x.test"), undefined);
});

test("sign-up with the platform unreachable: 503, nothing made", async () => {
  figbloomAccounts.client = () => null;
  try {
    const res = await call("POST", "/api/auth/register-company", { body: { ownerName: "Juma", email: "juma@x.test", password: STRONG } });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "accounts_unavailable");
    assert.equal(userByEmail("juma@x.test"), undefined);
  } finally {
    figbloomAccounts.client = () => fakeClient;
  }
});

test("with the switch off, sign-up is as before: no Figbloom account", async () => {
  process.env.COGNITO_SIGN_IN = "off";
  const res = await call("POST", "/api/auth/register-company", { body: { ownerName: "Juma", email: "juma@x.test", password: "eight chars" } });
  assert.equal(res.status, 201);
  assert.deepEqual(platformCalls, []);
  assert.equal(userByEmail("juma@x.test").identitySub, null);
  assert.equal(viaOf(res.body.accessToken), "password");
});

// ---- the "Set your password" page

test("a linked person's reset link sets their first Figbloom password, not Fleet's", async () => {
  accounts.set("ann@a.test", { sub: "sub-ann", password: null, createdByFleet: true });
  userByEmail("ann@a.test").identitySub = "sub-ann";
  const link = resetLinkFor("admin-a");
  const res = await call("POST", "/api/auth/reset-password", { body: { ...link, newPassword: STRONG } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.figbloom, true);
  assert.equal(accounts.get("ann@a.test").password, STRONG);
  assert.equal(accounts.get("ann@a.test").emailVerified, true, "the link came to this inbox: the email is proven");
  const ann = userByEmail("ann@a.test");
  assert.equal(ann.passwordHash, hash, "Fleet's password unchanged");
  assert.equal(ann.resetPasswordTokenHash, null, "the link is used up");
  // single use
  assert.equal((await call("POST", "/api/auth/reset-password", { body: { ...link, newPassword: STRONG } })).status, 400);
});

test("a linked person who already has a Figbloom password is sent to Figbloom's reset", async () => {
  accounts.set("ann@a.test", { sub: "sub-ann", password: "set", createdByFleet: true });
  userByEmail("ann@a.test").identitySub = "sub-ann";
  const res = await call("POST", "/api/auth/reset-password", { body: { ...resetLinkFor("admin-a"), newPassword: STRONG } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "use_figbloom_reset");
  assert.equal(userByEmail("ann@a.test").passwordHash, hash);
});

test("a weak first password is refused with the Figbloom rule", async () => {
  accounts.set("ann@a.test", { sub: "sub-ann", password: null, createdByFleet: true });
  userByEmail("ann@a.test").identitySub = "sub-ann";
  const res = await call("POST", "/api/auth/reset-password", { body: { ...resetLinkFor("admin-a"), newPassword: "short pass" } });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "invalid_password");
});

test("a driver who is also linked keeps resetting the app password once Figbloom's is set", async () => {
  accounts.set("dan@a.test", { sub: "sub-dan", password: "set", createdByFleet: true });
  userByEmail("dan@a.test").identitySub = "sub-dan";
  const res = await call("POST", "/api/auth/reset-password", { body: { ...resetLinkFor("driver-a"), newPassword: "new app password" } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(await bcrypt.compare("new app password", userByEmail("dan@a.test").passwordHash));
});

test("an unlinked driver resets Fleet's password as before", async () => {
  const res = await call("POST", "/api/auth/reset-password", { body: { ...resetLinkFor("driver-a"), newPassword: "new app password" } });
  assert.equal(res.status, 200);
  assert.deepEqual(platformCalls, []);
  assert.ok(await bcrypt.compare("new app password", userByEmail("dan@a.test").passwordHash));
});

// ---- invitations

test("a new person accepts a team invitation: Figbloom account (email proven), Fleet user linked, customers session", async () => {
  const token = await invite("new@x.test");
  const res = await call("POST", `/api/invitations/token/${token}/accept`, { body: { fullName: "New Person", password: STRONG } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(platformCalls.at(-1), { call: "createUser", email: "new@x.test", name: "New Person", password: STRONG, email_proven: true });
  const user = userByEmail("new@x.test");
  assert.equal(user.identitySub, "sub-1");
  assert.equal(await bcrypt.compare(STRONG, user.passwordHash), false);
  assert.equal(viaOf(res.body.accessToken), "customers");
  assert.equal(res.body.user.role, "ACCOUNTANT");
});

test("an email with a Fleet user, or a Figbloom account, signs in first: 409 sign_in_first, the invitation stays open", async () => {
  db.users.push({ id: "bea", email: "bea@b.test", fullName: "Bea", passwordHash: hash, identitySub: null, status: "active", isPlatformAdmin: false, createdAt: new Date() });
  const forBea = await invite("bea@b.test");
  const bea = await call("POST", `/api/invitations/token/${forBea}/accept`, { body: { password: PASSWORD } });
  assert.equal(bea.status, 409);
  assert.equal(bea.body.code, "sign_in_first");

  accounts.set("hr@x.test", { sub: "sub-hr", password: "x", createdByFleet: false });
  const forHr = await invite("hr@x.test");
  const hr = await call("POST", `/api/invitations/token/${forHr}/accept`, { body: { fullName: "From HR", password: STRONG } });
  assert.equal(hr.status, 409);
  assert.equal(hr.body.code, "sign_in_first");
  assert.equal(userByEmail("hr@x.test"), undefined);
  assert.ok(db.invitations.every((i) => i.acceptedAt === null));
});

test("a weak password on the invitation page is a 400 with the rule, and nothing is made", async () => {
  const token = await invite("new@x.test");
  const res = await call("POST", `/api/invitations/token/${token}/accept`, { body: { fullName: "New Person", password: "a long password" } });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "invalid_password");
  assert.equal(userByEmail("new@x.test"), undefined);
});

test("driver invitations are unchanged: Fleet's password, no Figbloom account", async () => {
  const token = await invite("newdriver@x.test", "DRIVER");
  const res = await call("POST", `/api/invitations/token/${token}/accept`, { body: { fullName: "Newdriver", password: "a long password" } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(platformCalls, []);
  assert.ok(await bcrypt.compare("a long password", userByEmail("newdriver@x.test").passwordHash));
});

// ---- staff create a fleet for a client

const staffToken = () => jwt.sign({ id: "staff", via: "staff" }, process.env.JWT_SECRET);

test("staff create a fleet: the owner's Figbloom account is made without a password and linked", async () => {
  const res = await call("POST", "/api/support/fleets", { token: staffToken(), body: { fleetName: "Juma Transport", ownerName: "Juma", ownerEmail: "juma@x.test" } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(platformCalls, [{ call: "createUser", email: "juma@x.test", name: "Juma", password: undefined, email_proven: false }]);
  assert.equal(userByEmail("juma@x.test").identitySub, "sub-1");
  assert.match(res.body.message, /emailed a link to set their password/);
});

test("staff create a fleet for someone with a Figbloom account: linked, and told they sign in with it", async () => {
  accounts.set("juma@x.test", { sub: "sub-hr", password: "x", createdByFleet: false });
  const res = await call("POST", "/api/support/fleets", { token: staffToken(), body: { fleetName: "Juma Transport", ownerName: "Juma", ownerEmail: "juma@x.test" } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(userByEmail("juma@x.test").identitySub, "sub-hr");
  assert.match(res.body.message, /already has a Figbloom account/);
});

// ---- the backfill

test("the backfill links owners and team, not drivers or staff; a dry run changes nothing; twice is harmless", async () => {
  const lines = [];
  const dry = await backfillFigbloomAccounts(prisma, { log: (l) => lines.push(l) });
  assert.equal(dry.total, 2);
  assert.deepEqual(platformCalls, []);
  assert.ok(lines.every((l) => l.startsWith("would link")));

  accounts.set("ann@a.test", { sub: "sub-ann", password: "x", createdByFleet: false });
  const welcomed = [];
  const run = await backfillFigbloomAccounts(prisma, { apply: true, sendWelcome: async (u, companyName) => welcomed.push([u.email, companyName]), log: () => {} });
  assert.deepEqual(run, { total: 2, linked: 2, emailed: 1, existing: 1, failed: 0 });
  assert.equal(userByEmail("ann@a.test").identitySub, "sub-ann");
  assert.ok(userByEmail("mike@a.test").identitySub);
  assert.equal(userByEmail("dan@a.test").identitySub, null);
  assert.equal(userByEmail("staff@figbloom.test").identitySub, null);
  assert.deepEqual(welcomed, [["mike@a.test", "Mike's Fleet"]]);

  const again = await backfillFigbloomAccounts(prisma, { apply: true, sendWelcome: async () => assert.fail("no second email"), log: () => {} });
  assert.equal(again.total, 0);
});

test("the backfill carries on past one failure and counts it", async () => {
  figbloomAccounts.client = () => null;
  try {
    const run = await backfillFigbloomAccounts(prisma, { apply: true, sendWelcome: async () => {}, log: () => {} });
    assert.deepEqual(run, { total: 2, linked: 0, emailed: 0, existing: 0, failed: 2 });
  } finally {
    figbloomAccounts.client = () => fakeClient;
  }
});

// ---- "Confirm your email" after signing up

test("sign-up's confirm link marks the new Figbloom account's email verified; using it again is harmless", async () => {
  const res = await call("POST", "/api/auth/register-company", { body: { ownerName: "Juma", email: "juma@x.test", password: STRONG } });
  assert.equal(res.status, 201);
  const user = userByEmail("juma@x.test");
  assert.equal(accounts.get("juma@x.test").emailVerified, undefined);
  const link = confirmEmailLink(user);
  assert.match(link, /\/confirm-email\?token=/);
  const token = decodeURIComponent(link.split("token=")[1]);
  const first = await call("POST", "/api/auth/confirm-email", { body: { token } });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body, { confirmed: true, email: "juma@x.test" });
  assert.equal(accounts.get("juma@x.test").emailVerified, true);
  assert.equal((await call("POST", "/api/auth/confirm-email", { body: { token } })).status, 200);
});

test("a forged, expired or unrelated token confirms nothing", async () => {
  accounts.set("ann@a.test", { sub: "sub-ann", password: "x", createdByFleet: true });
  const ann = userByEmail("ann@a.test");
  ann.identitySub = "sub-ann";
  const bad = async (token) => {
    const r = await call("POST", "/api/auth/confirm-email", { body: { token } });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "confirm_link_invalid");
  };
  // signed with JWT_SECRET itself (a sign-in token's key), or the right shape forged
  await bad(jwt.sign({ typ: "confirm_email", uid: ann.id, sub: "sub-ann" }, process.env.JWT_SECRET));
  // a sign-in token is never a confirm token
  await bad(jwt.sign({ id: ann.id }, process.env.JWT_SECRET));
  await bad("not a token");
  // made for an account that has since been linked to another Figbloom account
  const stale = confirmEmailToken({ id: ann.id, identitySub: "sub-old" });
  await bad(stale);
  assert.equal(accounts.get("ann@a.test").emailVerified, undefined);
  assert.ok(!platformCalls.some((c) => c.call === "markEmailVerified"));
});

