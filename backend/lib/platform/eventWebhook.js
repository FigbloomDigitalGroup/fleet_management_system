// POST /api/platform/events: events from the platform's relay
// (FLEET_HR_CONTRACT.md section 3; figbloom-platform README "Event relay").
// Signed exactly like the decision webhook (PLATFORM_WEBHOOK_SECRET):
//
//   x-figbloom-event: hr.employee.left
//   x-figbloom-delivery: <one per event and receiver, the same on every retry>
//   x-figbloom-timestamp / x-figbloom-signature
//   {"event":{"type","id","occurred_at","source","platform_tenant_id",
//             "tenant_local_id" (Fleet's Company.id),"data":{...}},"delivered_at"}
//
// - Unsigned, wrongly signed or older than 5 minutes: 401.
// - HR_INTEGRATION_ENABLED off: 503 + Retry-After (the platform keeps it).
// - Applied, repeated, stale, or the owner (never deactivated by HR): 200.
// - A company or person Fleet doesn't know (the relay also carries HR events
//   about Schools people, and a backlog may arrive when the webhook is first
//   registered): 200, ignored, logged at debug level. Never 4xx/5xx for that.
// - A known person of another Fleet company, or a leave application recorded
//   for someone else: 422 (stops for good).
// - Bad body: 400. A database failure: 500 (retried).
// - Signed but a type Fleet doesn't handle: 202, so it isn't retried forever.
import { verifyFigbloomWebhook } from "./signature.js";
import { hrIntegrationEnabled } from "./settings.js";

const LOCAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HANDLED = new Set(["hr.employee.left", "hr.leave.approved", "hr.leave.cancelled"]);

const fail = (res, status, code, error) => res.status(status).json({ error, code });
const ignored = (res, outcome) => res.json({ ok: true, applied: false, ignored: true, outcome });
const isDay = (v) => typeof v === "string" && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function makeEventWebhookHandler({ db, applyEmployeeLeft, applyLeaveEvent, env = process.env, now = Date.now, log = console }) {
  return async function receiveEvent(req, res) {
    const secret = env.PLATFORM_WEBHOOK_SECRET;
    if (!secret) {
      log.error("[platform] PLATFORM_WEBHOOK_SECRET is not set; refusing every event delivery");
      return fail(res, 401, "unauthorized", "The signature is missing or wrong");
    }
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : "";
    if (!verifyFigbloomWebhook(secret, raw, req.get("x-figbloom-signature"), req.get("x-figbloom-timestamp"), now())) {
      return fail(res, 401, "unauthorized", "The signature is missing or wrong, or the timestamp is too old");
    }
    const delivery = (req.get("x-figbloom-delivery") ?? "").trim();
    if (!delivery || delivery.length > 100) return fail(res, 400, "invalid_delivery", "x-figbloom-delivery is required");

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail(res, 400, "invalid_json", "The body must be JSON");
    }
    const event = body?.event;
    const type = typeof event?.type === "string" ? event.type : req.get("x-figbloom-event");
    if (!HANDLED.has(type)) return res.status(202).json({ ok: true, applied: false, ignored: type ?? null });

    if (!hrIntegrationEnabled(env)) {
      log.warn(`[platform] ${type} (delivery ${delivery}) arrived before HR_INTEGRATION_ENABLED; not applied, the platform will retry`);
      res.set("Retry-After", "3600");
      return fail(res, 503, "hr_not_enabled", "Fleet does not apply HR events yet; deliver it again later");
    }

    const companyId = event?.tenant_local_id;
    const data = event?.data ?? {};
    const personId = typeof data.external_id === "string" ? data.external_id.trim() : "";
    const debug = (msg) => (log.debug ?? log.log).call(log, `[platform] ${type} (delivery ${delivery}) ignored: ${msg}`);
    // No Fleet id for the account (null: the account isn't linked to Fleet) or
    // for the person: not Fleet's, acknowledged so the relay doesn't retry it.
    if (typeof companyId !== "string" || !LOCAL_ID.test(companyId)) {
      debug("no Fleet company id");
      return ignored(res, "unknown_tenant");
    }
    if (!LOCAL_ID.test(personId)) {
      debug(`no Fleet person id (company ${companyId})`);
      return ignored(res, "not_found");
    }
    const occurredAt = typeof event.occurred_at === "string" && !Number.isNaN(Date.parse(event.occurred_at)) ? new Date(event.occurred_at) : new Date(now());
    const base = { deliveryId: delivery, eventId: typeof event.id === "string" ? event.id.slice(0, 200) : null, companyId, personId };

    let result;
    try {
      if (type === "hr.employee.left") {
        result = await applyEmployeeLeft(db, { ...base, employeeNumber: data.employee_number ?? null, leftOn: isDay(data.left_on) ? data.left_on : null });
      } else {
        const applicationId = data.application_id == null ? "" : String(data.application_id).trim();
        if (!applicationId || applicationId.length > 100) return fail(res, 400, "invalid_application", "data.application_id is required");
        if (!isDay(data.start_date) || !isDay(data.end_date) || data.end_date < data.start_date) {
          return fail(res, 400, "invalid_dates", "data.start_date and data.end_date must be YYYY-MM-DD, start first");
        }
        result = await applyLeaveEvent(db, {
          ...base,
          type,
          applicationId,
          leaveType: typeof data.leave_type === "string" ? data.leave_type.slice(0, 100) : null,
          startDate: data.start_date,
          endDate: data.end_date,
          halfDay: data.half_day === true,
          occurredAt,
        });
      }
    } catch (err) {
      log.error(`[platform] could not apply ${type} delivery ${delivery}:`, err?.message || err);
      return fail(res, 500, "internal_error", "Could not apply the event; try again");
    }

    switch (result.outcome) {
      case "unknown_tenant":
        debug(`no company ${companyId} in Fleet`);
        return ignored(res, result.outcome);
      case "not_found":
        debug(`no person ${personId} in company ${companyId}`);
        return ignored(res, result.outcome);
      case "tenant_mismatch":
        log.warn(`[platform] ${type}: person ${personId} is not in company ${companyId} (delivery ${delivery})`);
        return fail(res, 422, "tenant_mismatch", "That person is not in that Fleet company");
      case "person_mismatch":
        log.warn(`[platform] ${type}: application ${data.application_id} belongs to someone else (delivery ${delivery})`);
        return fail(res, 422, "person_mismatch", "That leave application is recorded for another person");
      case "owner_ignored":
        log.warn(`[platform] hr.employee.left for the owner of company ${companyId} ignored: owners aren't deactivated from HR (delivery ${delivery})`);
        return res.json({ ok: true, applied: false, outcome: result.outcome });
      case "duplicate":
      case "stale":
      case "already_inactive":
      case "already_approved":
      case "already_cancelled":
      case "other_dates":
        return res.json({ ok: true, applied: false, outcome: result.outcome });
      default:
        return res.json({ ok: true, applied: true, outcome: result.outcome });
    }
  };
}
