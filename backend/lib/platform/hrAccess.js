// Fleet's side of Figbloom HR for signed-in people (FLEET_HR_CONTRACT.md
// section 3): one-click into HR (HR & Payroll) and My HR.
//
// - HR & Payroll (owner, full admins, accountants): POST /handoffs on the
//   platform (target "hr") gives a one-time sign-in link; the browser opens it.
// - My HR (everyone in a company, drivers included; the app will use the same
//   routes later): payslips (HR doesn't make PDFs: the web app prints the
//   payslip), leave, attendance and KPIs. Fleet calls HR's
//   /api/integrations/my-hr/* with its own
//   platform token. The person and the company come from the session only,
//   never from the request. HR reuses the Schools headers for this:
//   x-figbloom-school (here Fleet's Company.id) and x-figbloom-person (User.id).
// Everything is hidden and answers 404 hr_off while HR_INTEGRATION_ENABLED is
// off, and is refused in a Figbloom staff support view.
import { hrIntegrationEnabled, hrMyHrUrl } from "./settings.js";
import { canOpenHr, hasMyHr, ROLE_TITLES } from "../staffRoles.js";
import { realEmail } from "./staffEvents.js";
import { unavailabilityBetween } from "./hrEvents.js";

const TIMEOUT_MS = 15_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RETURN_TO = /^\/[A-Za-z0-9/_\-.?=&%]{0,200}$/;

// The My HR calls Fleet passes on: [method, Fleet path after /api/hr/my, HR path].
// Anything else is 404 here, so the proxy can't be pointed elsewhere in HR.
const MY_HR_ROUTES = [
  ["GET", /^\/summary$/],
  ["GET", /^\/payslips$/],
  ["GET", /^\/payslips\/[A-Za-z0-9_-]{1,64}$/],
  ["GET", /^\/leave$/],
  ["GET", /^\/leave\/form$/],
  ["POST", /^\/leave\/applications$/],
  ["POST", /^\/leave\/applications\/[A-Za-z0-9_-]{1,64}\/cancel$/],
  ["GET", /^\/attendance$/],
  ["GET", /^\/kpis$/],
];

const fail = (res, status, code, error) => res.status(status).json({ error, code });

/** deps: { db, getClient () -> PlatformClient | null, env, fetch } */
export function makeHrHandlers({ db, getClient, env = process.env, fetch: fetchFn = globalThis.fetch, log = console }) {
  const enabled = () => hrIntegrationEnabled(env);

  async function status(req, res) {
    const on = enabled();
    return res.json({
      enabled: on,
      canOpenHr: on && canOpenHr(req.user),
      hasMyHr: on && hasMyHr(req.user) && !!hrMyHrUrl(env),
    });
  }

  // POST /api/hr/handoff { returnTo? } -> { url, expiresAt }
  async function handoff(req, res) {
    if (!enabled()) return fail(res, 404, "hr_off", "Figbloom HR isn't switched on for Fleet yet.");
    if (!canOpenHr(req.user)) return fail(res, 403, "role_forbidden", "Only the fleet owner, full admins and accountants open HR & Payroll.");
    const client = getClient();
    if (!client) return fail(res, 503, "platform_not_configured", "Figbloom HR can't be reached from Fleet yet.");
    try {
      const person = await db.user.findUnique({ where: { id: req.user.id }, select: { id: true, fullName: true, email: true, role: true } });
      if (!person) return fail(res, 401, "unauthorized", "Sign in again.");
      const returnTo = typeof req.body?.returnTo === "string" && RETURN_TO.test(req.body.returnTo) ? req.body.returnTo : undefined;
      const answer = await client.createHandoff({
        target: "hr",
        tenant_local_id: req.user.companyId,
        person: { external_id: person.id, name: person.fullName || ROLE_TITLES[person.role], email: realEmail(person.email), role: String(person.role).toLowerCase() },
        ...(returnTo ? { return_to: returnTo } : {}),
      });
      return res.json({ url: answer.url, expiresAt: answer.expires_at ?? null });
    } catch (err) {
      if (["target_not_enabled", "target_not_linked", "tenant_not_found"].includes(err?.code) || err?.status === 404) {
        return fail(res, 409, "hr_not_enabled_for_company", "HR & Payroll isn't set up for your company yet. Ask Figbloom to switch it on.");
      }
      log.error("[hr] handoff failed:", err?.code || err?.message || err);
      return fail(res, 502, "platform_unavailable", "Figbloom HR didn't answer. Try again in a minute.");
    }
  }

  // /api/hr/my/* -> HR's /api/integrations/my-hr/*
  async function myHr(req, res) {
    if (!enabled()) return fail(res, 404, "hr_off", "My HR isn't available yet.");
    if (!hasMyHr(req.user)) return fail(res, 403, "role_forbidden", "My HR is for people in a fleet company.");
    const base = hrMyHrUrl(env);
    const client = getClient();
    if (!base || !client) return fail(res, 503, "hr_not_configured", "My HR isn't available yet.");
    const sub = req.path;
    if (!MY_HR_ROUTES.some(([m, p]) => m === req.method && p.test(sub))) return fail(res, 404, "not_found", "Not found");

    const query = new URLSearchParams();
    if (sub === "/attendance") {
      for (const k of ["from", "to"]) if (DAY.test(String(req.query[k] ?? ""))) query.set(k, req.query[k]);
    }
    const url = `${base}${sub}${query.size ? `?${query}` : ""}`;

    let upstream;
    try {
      const token = await client.accessToken();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        upstream = await fetchFn(url, {
          method: req.method,
          headers: {
            authorization: `Bearer ${token}`,
            accept: "application/json",
            "x-figbloom-school": String(req.user.companyId),
            "x-figbloom-person": String(req.user.id),
            "x-figbloom-product": "fleet",
            ...(req.method === "POST" ? { "content-type": "application/json" } : {}),
          },
          body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
          signal: controller.signal,
          redirect: "error",
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      log.error("[hr] my-hr call failed:", sub, err?.code || err?.message || err);
      return fail(res, 502, "hr_unavailable", "Figbloom HR didn't answer. Try again in a minute.");
    }

    let data = null;
    try {
      data = await upstream.json();
    } catch {
      /* not JSON */
    }
    if (upstream.status >= 500) {
      log.error("[hr] my-hr", sub, "answered", upstream.status);
      return fail(res, 502, "hr_unavailable", "Figbloom HR had a problem. Try again in a minute.");
    }
    res.set("Cache-Control", "private, no-store");
    // HR answers refusals as {error: {code, message, ...}}; Fleet's web app
    // reads {error: message, code, ...}.
    if (data && typeof data.error === "object" && data.error !== null) {
      const { code, message, ...extra } = data.error;
      data = { ...extra, error: message || "Figbloom HR refused this.", code: code ?? `http_${upstream.status}` };
    }
    return res.status(upstream.status).json(data ?? {});
  }

  // GET /api/hr/unavailability?from&to: approved leave in the company, for dispatch.
  async function unavailability(req, res) {
    if (!enabled() || !req.user.companyId) return res.json([]);
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? from);
    if (!DAY.test(from) || !DAY.test(to) || to < from) return fail(res, 400, "invalid_dates", "from and to must be YYYY-MM-DD");
    try {
      return res.json(await unavailabilityBetween(db, req.user.companyId, from, to));
    } catch (err) {
      log.error("[hr] unavailability failed:", err?.message || err);
      return fail(res, 500, "internal_error", "Failed to fetch leave");
    }
  }

  return { status, handoff, myHr, unavailability };
}
