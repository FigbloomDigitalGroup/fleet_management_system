import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyFigbloomWebhook, signFigbloomWebhook, secretsMatch } from "../lib/platform/signature.js";

const SECRET = "whsec-test-0123456789abcdef0123456789abcdef";
const BODY = '{"organization":{"id":"o1","local_id":"c1","status":"active","status_reason":null},"decided_by":"console:a@b.co","decided_at":"2026-11-12T10:00:00.000Z"}';
const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);

test("accepts the platform's own signature", () => {
  const { signature, timestamp } = signFigbloomWebhook(SECRET, BODY, NOW);
  assert.match(signature, /^sha256=[0-9a-f]{64}$/);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, signature, timestamp, NOW), true);
});

test("matches the platform's format: HMAC-SHA256 over <ts>.<body>", async () => {
  const { createHmac } = await import("node:crypto");
  const ts = String(NOW / 1000);
  const expected = `sha256=${createHmac("sha256", SECRET).update(`${ts}.${BODY}`).digest("hex")}`;
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, expected, ts, NOW), true);
});

test("refuses a changed body, a wrong secret, or a missing header", () => {
  const { signature, timestamp } = signFigbloomWebhook(SECRET, BODY, NOW);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY.replace("active", "suspended"), signature, timestamp, NOW), false);
  assert.equal(verifyFigbloomWebhook("another-secret", BODY, signature, timestamp, NOW), false);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, undefined, timestamp, NOW), false);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, signature, undefined, NOW), false);
  assert.equal(verifyFigbloomWebhook("", BODY, signature, timestamp, NOW), false);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, signature, "12a", NOW), false);
});

test("allows 5 minutes of clock difference either way, no more", () => {
  const { signature, timestamp } = signFigbloomWebhook(SECRET, BODY, NOW);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, signature, timestamp, NOW + 300_000), true);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, signature, timestamp, NOW - 300_000), true);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, signature, timestamp, NOW + 301_000), false);
  assert.equal(verifyFigbloomWebhook(SECRET, BODY, signature, timestamp, NOW - 301_000), false);
});

test("secretsMatch compares whole values", () => {
  assert.equal(secretsMatch("abc", "abc"), true);
  assert.equal(secretsMatch("abc", "abcd"), false);
  assert.equal(secretsMatch("", ""), false);
  assert.equal(secretsMatch(undefined, "abc"), false);
});
