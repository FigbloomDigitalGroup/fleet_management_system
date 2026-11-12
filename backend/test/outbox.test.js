import { test } from "node:test";
import assert from "node:assert/strict";
import { processQueue, backoffSeconds, organizationBody, tenantBody } from "../lib/platform/outbox.js";
import { PlatformClient, PlatformError } from "../lib/platform/client.js";

const quiet = { error() {}, log() {} };

// An in-memory PlatformSyncQueue with the same rules as lib/platform/store.js.
function memoryQueue(rows) {
  const state = rows.map((r) => ({ attempts: 0, version: 1, kind: "company", doneAt: null, retryIn: null, lastError: null, ...r }));
  return {
    state,
    async claim(limit) {
      const due = state.filter((r) => !r.doneAt && r.retryIn === null).slice(0, limit);
      for (const r of due) r.attempts++;
      return due.map((r) => ({ ...r }));
    },
    async done(id, version) {
      const r = state.find((x) => x.id === id);
      if (r.version !== version) return false;
      r.doneAt = new Date();
      return true;
    },
    async failed(id, error, retryInSeconds) {
      const r = state.find((x) => x.id === id);
      r.retryIn = retryInSeconds;
      r.lastError = error;
    },
  };
}

const company = (id, extra = {}) => ({ id, name: `Company ${id}`, slug: `company-${id}`, status: "pending", createdAt: new Date("2026-11-01T00:00:00Z"), ownerEmail: `owner@${id}.co`, ...extra });

function fakeClient({ failOrg } = {}) {
  const calls = [];
  return {
    calls,
    async putOrganization(id, body) {
      calls.push(["org", id, body]);
      if (failOrg) throw failOrg(id);
      return { organization_id: `org-${id}`, status: "pending" };
    },
    async putTenant(id, body) {
      calls.push(["tenant", id, body]);
      return { tenant_id: `ten-${id}` };
    },
  };
}

test("backoff: 1, 2, 4 ... minutes, at most an hour", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 20].map(backoffSeconds), [60, 120, 240, 480, 960, 1920, 3600, 3600, 3600]);
  assert.equal(backoffSeconds(0), 60);
});

test("sends the organisation then the tenant, records both links, and completes the row", async () => {
  const queue = memoryQueue([{ id: 1, localId: "c1" }]);
  const client = fakeClient();
  const links = [];
  const report = await processQueue({
    queue,
    client,
    loadCompany: async (id) => company(id),
    recordLink: async (...l) => links.push(l),
    log: quiet,
  });
  assert.equal(report.sent, 1);
  assert.deepEqual(client.calls.map((c) => c[0]), ["org", "tenant"]);
  assert.deepEqual(client.calls[0][2], { name: "Company c1", owner_email: "owner@c1.co", created_at: "2026-11-01T00:00:00.000Z" });
  assert.equal(client.calls[1][2].organization_local_id, "c1");
  assert.deepEqual(links, [["organization", "c1", "org-c1"], ["tenant", "c1", "ten-c1"]]);
  assert.ok(queue.state[0].doneAt);
});

test("a refused send is retried later with backoff; an outage defers the rest of the batch", async () => {
  const queue = memoryQueue([{ id: 1, localId: "c1", attempts: 2 }, { id: 2, localId: "c2" }, { id: 3, localId: "c3" }]);
  const client = fakeClient({ failOrg: () => new PlatformError("The platform could not be reached (timed out).", 0, "unreachable") });
  const report = await processQueue({ queue, client, loadCompany: async (id) => company(id), recordLink: async () => {}, log: quiet });
  assert.equal(report.sent, 0);
  assert.equal(report.deferred, 2);
  assert.equal(queue.state[0].retryIn, backoffSeconds(3)); // its third attempt failed: 4 minutes
  assert.equal(queue.state[1].retryIn, 60);
  assert.equal(queue.state[2].retryIn, 60);
  assert.equal(client.calls.length, 1, "only the first company was tried");
  assert.ok(queue.state.every((r) => !r.doneAt));
});

test("a 4xx for one company doesn't hold up the others", async () => {
  const queue = memoryQueue([{ id: 1, localId: "bad" }, { id: 2, localId: "c2" }]);
  const client = fakeClient();
  const put = client.putOrganization;
  client.putOrganization = async (id, body) => {
    if (id === "bad") throw new PlatformError("Unknown field", 400, "bad_request");
    return put(id, body);
  };
  const report = await processQueue({ queue, client, loadCompany: async (id) => company(id), recordLink: async () => {}, log: quiet });
  assert.equal(report.sent, 1);
  assert.equal(queue.state[0].retryIn, 60);
  assert.ok(queue.state[1].doneAt);
});

test("a company changed while being sent stays queued; a deleted one is completed", async () => {
  const queue = memoryQueue([{ id: 1, localId: "c1" }, { id: 2, localId: "gone" }]);
  const client = fakeClient();
  const put = client.putTenant;
  client.putTenant = async (id, body) => {
    queue.state[0].version++; // renamed meanwhile
    return put(id, body);
  };
  await processQueue({ queue, client, loadCompany: async (id) => (id === "gone" ? null : company(id)), recordLink: async () => {}, log: quiet });
  assert.equal(queue.state[0].doneAt, null);
  assert.ok(queue.state[1].doneAt);
});

test("with decisions on, the platform's answer is adopted", async () => {
  const client = fakeClient();
  client.putOrganization = async () => ({ organization_id: "o", status: "active" });
  const adopted = [];
  const run = (decisionsEnabled) =>
    processQueue({
      queue: memoryQueue([{ id: 1, localId: "c1" }]),
      client,
      loadCompany: async (id) => company(id),
      recordLink: async () => {},
      decisionsEnabled,
      adoptStatus: async (c, answer) => (adopted.push([c.id, answer.status]), "applied"),
      log: quiet,
    });
  assert.equal((await run(false)).adopted, 0);
  assert.equal((await run(true)).adopted, 1);
  assert.deepEqual(adopted, [["c1", "active"]]);
});

test("bodies fit the platform's rules", () => {
  const long = company("c1", { name: "x".repeat(300), slug: "-bad-", ownerEmail: "not an email" });
  assert.equal(organizationBody(long).name.length, 200);
  assert.equal(organizationBody(long).owner_email, null);
  assert.equal("slug" in tenantBody(long), false);
  assert.equal(tenantBody(company("c2")).slug, "company-c2");
});

test("the client caches its token and fetches a new one after a 401", async () => {
  let tokens = 0;
  const seen = [];
  let refuseNext = false;
  const fetch = async (url, init) => {
    if (url === "https://auth.example/oauth2/token") {
      tokens++;
      return new Response(JSON.stringify({ access_token: `t${tokens}`, expires_in: 3600 }), { status: 200 });
    }
    seen.push(init.headers.authorization);
    if (refuseNext) {
      refuseNext = false;
      return new Response("", { status: 401 });
    }
    return new Response(JSON.stringify({ organization_id: "o1", status: "pending" }), { status: 200 });
  };
  const client = new PlatformClient({ clientId: "id", clientSecret: "s", tokenUrl: "https://auth.example/oauth2/token", apiUrl: "https://api.example" }, { fetch });
  await client.putOrganization("c1", { name: "A" });
  await client.putOrganization("c1", { name: "A" });
  assert.equal(tokens, 1);
  refuseNext = true;
  await client.putOrganization("c1", { name: "A" });
  assert.equal(tokens, 2);
  assert.deepEqual(seen, ["Bearer t1", "Bearer t1", "Bearer t1", "Bearer t2"]);
});
