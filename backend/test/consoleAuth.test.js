import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { requirePlatformConsoleSecret } from "../middleware/platformConsoleAuth.js";

const SECRET = "console-secret-0123456789abcdef0123456789abcdef";
const saved = process.env.PLATFORM_CONSOLE_SECRET;

function call(header) {
  const req = { get: (name) => (name.toLowerCase() === "x-platform-secret" ? header : undefined) };
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  let passed = false;
  requirePlatformConsoleSecret(req, res, () => (passed = true));
  return { passed, res };
}

beforeEach(() => {
  process.env.PLATFORM_CONSOLE_SECRET = SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.PLATFORM_CONSOLE_SECRET;
  else process.env.PLATFORM_CONSOLE_SECRET = saved;
});

test("lets the console's backend in with the shared secret", () => {
  assert.equal(call(SECRET).passed, true);
});

test("refuses a missing, wrong or partial secret with 401", () => {
  for (const header of [undefined, "", "wrong", SECRET.slice(0, -1), `${SECRET}x`]) {
    const { passed, res } = call(header);
    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
  }
});

test("refuses everything when no (or a too short) secret is configured", () => {
  delete process.env.PLATFORM_CONSOLE_SECRET;
  assert.equal(call("").res.statusCode, 503);
  assert.equal(call(undefined).passed, false);
  process.env.PLATFORM_CONSOLE_SECRET = "short";
  assert.equal(call("short").passed, false);
});
