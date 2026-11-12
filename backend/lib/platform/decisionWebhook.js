// POST /api/platform/decisions: company decisions from the Figbloom platform.
// When Figbloom staff approve, reject, suspend or reactivate a company in the
// console, the platform POSTs the decision here, signed, and retries
// (1, 2, 4 ... minutes, then hourly) until it gets a 2xx; a 4xx other than
// 408/425/429 stops it for good.
//
//   x-figbloom-event: organization.status_changed
//   x-figbloom-delivery: <id, the same on every retry>
//   x-figbloom-timestamp / x-figbloom-signature (lib/platform/signature.js)
//   {"organization":{"id","local_id","status","status_reason"},"decided_by","decided_at"}
//
// - The raw body is verified first (the route gets it unparsed), against
//   PLATFORM_WEBHOOK_SECRET; anything unsigned, wrongly signed or older than
//   5 minutes is 401.
// - Only the local id (Company.id) and the status decide what happens.
// - While PLATFORM_DECISIONS_ENABLED is off, a correctly signed decision is
//   answered 503 and not applied: the platform keeps it and delivers it again
//   later, so nothing decided in the console is lost before switch-on (Fleet
//   has no reconcile job to pick up a decision it acknowledged and dropped).
//   Once switched on, the next retry applies it; out-of-order retries are
//   ordered by decided_at.
// - Applied: 200. A repeat delivery or an older decision: 200, not applied.
//   A company Fleet doesn't have: 404 (the platform stops). A database
//   failure: 500 (the platform retries).
import { verifyFigbloomWebhook } from "./signature.js";
import { platformDecisionsEnabled } from "./settings.js";

const STATUSES = new Set(["pending", "active", "suspended", "rejected"]);
const LOCAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const fail = (res, status, code, error) => res.status(status).json({ error, code });

export function makeDecisionWebhookHandler({ db, applyDecision, env = process.env, now = Date.now }) {
  return async function receiveDecision(req, res) {
    const secret = env.PLATFORM_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[platform] PLATFORM_WEBHOOK_SECRET is not set; refusing every decision delivery");
      return fail(res, 401, "unauthorized", "The signature is missing or wrong");
    }
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : "";
    if (!verifyFigbloomWebhook(secret, raw, req.get("x-figbloom-signature"), req.get("x-figbloom-timestamp"), now())) {
      return fail(res, 401, "unauthorized", "The signature is missing or wrong, or the timestamp is too old");
    }

    const event = req.get("x-figbloom-event") ?? "organization.status_changed";
    if (event !== "organization.status_changed") {
      // signed by the platform but not something Fleet handles: acknowledged, so it isn't retried forever
      return res.status(202).json({ ok: true, applied: false, ignored: event });
    }
    const delivery = (req.get("x-figbloom-delivery") ?? "").trim();
    if (!delivery || delivery.length > 100) return fail(res, 400, "invalid_delivery", "x-figbloom-delivery is required");

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail(res, 400, "invalid_json", "The body must be JSON");
    }
    const localId = body?.organization?.local_id;
    const status = body?.organization?.status;
    if (typeof localId !== "string" || !LOCAL_ID.test(localId)) return fail(res, 400, "invalid_organization", "organization.local_id must be a Fleet company id");
    if (typeof status !== "string" || !STATUSES.has(status)) {
      return fail(res, 400, "invalid_status", "organization.status must be pending, active, suspended or rejected");
    }
    const decidedAt = typeof body.decided_at === "string" && !Number.isNaN(Date.parse(body.decided_at)) ? new Date(body.decided_at) : null;

    if (!platformDecisionsEnabled(env)) {
      console.warn(`[platform] ${status} for company ${localId} (delivery ${delivery}) arrived before PLATFORM_DECISIONS_ENABLED; not applied, the platform will retry`);
      res.set("Retry-After", "3600");
      return fail(res, 503, "decisions_not_enabled", "Fleet does not apply platform decisions yet; deliver it again later");
    }

    let result;
    try {
      result = await applyDecision(db, { companyId: localId, status, deliveryId: delivery, decidedAt, source: "webhook" });
    } catch (err) {
      console.error(`[platform] could not apply delivery ${delivery}:`, err?.message || err);
      return fail(res, 500, "internal_error", "Could not apply the decision; try again");
    }
    switch (result.outcome) {
      case "applied":
      case "unchanged":
        return res.json({ ok: true, applied: true, outcome: result.outcome, status: result.status });
      case "duplicate":
      case "stale":
        return res.json({ ok: true, applied: false, outcome: result.outcome });
      case "not_found":
        console.warn(`[platform] no company ${localId} in Fleet (delivery ${delivery})`);
        return fail(res, 404, "organization_not_found", "Fleet has no company with that id");
      default:
        return fail(res, 500, "internal_error", "Could not apply the decision; try again");
    }
  };
}
