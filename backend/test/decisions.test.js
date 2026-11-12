import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPlatformDecision } from "../lib/platform/decisions.js";
import { makeDecisionWebhookHandler } from "../lib/platform/decisionWebhook.js";
import { signFigbloomWebhook } from "../lib/platform/signature.js";
import { fakeDb } from "./helpers/fakeDb.js";

function setup() {
  const notified = [];
  const db = fakeDb({ companies: [{ id: "c1", name: "Acme", status: "pending" }] });
  const apply = (input) => applyPlatformDecision(db, input, { notify: (_db, before, company) => notified.push([before.status, company.status]) });
  return { db, notified, apply };
}

test("approves a pending company once, however often the delivery repeats", async () => {
  const { db, notified, apply } = setup();
  const decision = { companyId: "c1", status: "active", deliveryId: "d1", decidedAt: new Date("2026-11-12T10:00:00Z") };
  assert.deepEqual(await apply(decision), { outcome: "applied", status: "active", previous: "pending" });
  assert.deepEqual(await apply(decision), { outcome: "duplicate" });
  assert.deepEqual(await apply(decision), { outcome: "duplicate" });
  assert.equal(db.state().companies[0].status, "active");
  assert.deepEqual(notified, [["pending", "active"]], "the approval email goes out once");
  assert.deepEqual(db.state().deliveries.map((d) => [d.deliveryId, d.outcome]), [["d1", "applied"]]);
});

test("an older decision arriving after a newer one is not applied", async () => {
  const { db, apply } = setup();
  await apply({ companyId: "c1", status: "suspended", deliveryId: "new", decidedAt: new Date("2026-11-12T11:00:00Z") });
  const late = await apply({ companyId: "c1", status: "active", deliveryId: "old", decidedAt: new Date("2026-11-12T10:00:00Z") });
  assert.equal(late.outcome, "stale");
  assert.equal(db.state().companies[0].status, "suspended");
});

test("the same status again is unchanged; an unknown company is not_found", async () => {
  const { apply } = setup();
  assert.equal((await apply({ companyId: "c1", status: "pending", deliveryId: "d1" })).outcome, "unchanged");
  assert.equal((await apply({ companyId: "nope", status: "active", deliveryId: "d2" })).outcome, "not_found");
  assert.equal((await apply({ companyId: "c1", status: "deleted", deliveryId: "d3" })).outcome, "invalid");
});

test("a failure rolls the delivery back, so the platform's retry applies it", async () => {
  const { db, apply } = setup();
  db.failNext.companyUpdate = true;
  await assert.rejects(apply({ companyId: "c1", status: "rejected", deliveryId: "d1" }));
  assert.equal(db.state().deliveries.length, 0);
  assert.equal((await apply({ companyId: "c1", status: "rejected", deliveryId: "d1" })).outcome, "applied");
  assert.equal(db.state().companies[0].status, "rejected");
});

// ---- the webhook route

const SECRET = "whsec-test-0123456789abcdef0123456789abcdef";

function request(body, headers = {}) {
  const raw = Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const signed = signFigbloomWebhook(SECRET, raw.toString("utf8"));
  const all = { "x-figbloom-event": "organization.status_changed", "x-figbloom-delivery": "d1", "x-figbloom-signature": signed.signature, "x-figbloom-timestamp": signed.timestamp, ...headers };
  return { body: raw, get: (name) => all[name.toLowerCase()] };
}

function response() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  res.set = (k, v) => ((res.headers[k] = v), res);
  return res;
}

const decision = (status = "active") => ({
  organization: { id: "org-1", local_id: "c1", status, status_reason: null },
  decided_by: "console:staff@figbloom.org",
  decided_at: "2026-11-12T10:00:00.000Z",
});

function handler(enabled, db = fakeDb({ companies: [{ id: "c1", name: "Acme", status: "pending" }] })) {
  const env = { PLATFORM_WEBHOOK_SECRET: SECRET, PLATFORM_DECISIONS_ENABLED: enabled ? "true" : "false" };
  const applyDecision = (d, input) => applyPlatformDecision(d, input, { notify: () => {} });
  return { db, handle: makeDecisionWebhookHandler({ db, applyDecision, env }) };
}

test("webhook: a signed decision is applied, and a repeat is acknowledged without applying", async () => {
  const { db, handle } = handler(true);
  const first = response();
  await handle(request(decision()), first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.outcome, "applied");
  const again = response();
  await handle(request(decision()), again);
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.outcome, "duplicate");
  assert.equal(db.state().companies[0].status, "active");
});

test("webhook: an unsigned or tampered request is 401 and changes nothing", async () => {
  const { db, handle } = handler(true);
  const res = response();
  await handle(request(decision(), { "x-figbloom-signature": "sha256=00" }), res);
  assert.equal(res.statusCode, 401);
  const tampered = request(decision());
  tampered.body = Buffer.from(JSON.stringify(decision("suspended")));
  const res2 = response();
  await handle(tampered, res2);
  assert.equal(res2.statusCode, 401);
  assert.equal(db.state().companies[0].status, "pending");
});

test("webhook: while decisions are off, a signed decision is 503 (kept by the platform) and not applied", async () => {
  const { db, handle } = handler(false);
  const res = response();
  await handle(request(decision()), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "decisions_not_enabled");
  assert.equal(db.state().companies[0].status, "pending");
  assert.equal(db.state().deliveries.length, 0);
});

test("webhook: an unknown company is 404, a bad status 400", async () => {
  const { handle } = handler(true);
  const missing = decision();
  missing.organization.local_id = "nope";
  const res = response();
  await handle(request(missing), res);
  assert.equal(res.statusCode, 404);
  const res2 = response();
  await handle(request(decision("deleted"), { "x-figbloom-delivery": "d2" }), res2);
  assert.equal(res2.statusCode, 400);
});
