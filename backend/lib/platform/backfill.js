// The one-off backfill (scripts/platformBackfill.js): registers every
// existing company with the platform, as an organisation with its current
// status (backfill: true, the only time Fleet may send a status) and a tenant
// under it. A dry run (the default) only lists what it would send.
//
// Run it once after the decision webhook is registered and before
// PLATFORM_DECISIONS_ENABLED is switched on. Running it again only re-sends
// names: the platform refuses a status staff have already decided in the
// console (409 decided_on_platform), which is reported and leaves the
// console's decision alone.
import { PlatformError } from "./client.js";
import { organizationBody, tenantBody, platformStatusOf } from "./outbox.js";
import { loadCompanyForSync, recordPlatformLink, enqueueCompanySync } from "./store.js";
import { applyPlatformDecision } from "./decisions.js";

const PAGE = 200;

export async function backfillCompanies(db, client, { dryRun = true } = {}) {
  const report = { dryRun, companies: [], errors: [] };
  let cursor;
  for (;;) {
    const page = await db.company.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    for (const { id } of page) {
      const entry = await backfillCompany(db, client, id, { dryRun });
      if (!entry) continue;
      report.companies.push(entry);
      if (entry.result === "error") report.errors.push({ id, error: entry.error });
    }
    if (page.length < PAGE) break;
    cursor = page[page.length - 1].id;
  }
  return report;
}

// One company, the backfill way: its organisation with its current status
// (backfill: true), then its tenant. Also used by scripts/seedDemoFleet.js so
// the demo company reaches the console as active rather than as a new
// (pending) registration. A platform refusal doesn't throw: the entry's
// result is "registered", "decided_on_platform" (the console's decision is
// kept and only the name is sent) or "error" (with entry.error). null when
// there is no such company.
export async function backfillCompany(db, client, id, { dryRun = false } = {}) {
  const company = await loadCompanyForSync(db, id);
  if (!company) return null;
  const entry = { id, name: company.name, status: company.status, platformStatus: platformStatusOf(company.status), ownerEmail: company.ownerEmail };
  if (dryRun) return entry;
  try {
    let org;
    try {
      org = await client.putOrganization(id, { ...organizationBody(company), status: entry.platformStatus, backfill: true });
      entry.result = "registered";
    } catch (err) {
      if (!(err instanceof PlatformError && err.code === "decided_on_platform")) throw err;
      // decided in the console already: keep that decision, send the name only
      org = await client.putOrganization(id, organizationBody(company));
      entry.result = "decided_on_platform";
    }
    entry.platformOrganizationStatus = org?.status;
    await recordPlatformLink(db, "organization", id, org?.organization_id ?? null);
    const tenant = await client.putTenant(id, tenantBody(company));
    await recordPlatformLink(db, "tenant", id, tenant?.tenant_id ?? tenant?.id ?? null);
  } catch (err) {
    entry.result = "error";
    entry.error = err?.message || String(err);
  }
  return entry;
}

// Registers a company that is being set up already decided (the demo seed,
// a fleet Figbloom staff create for a client) the backfill way, so the
// console shows it with its status rather than as a new pending
// registration, then queues it like a normal registration for later name
// changes. client is null when the PLATFORM_* settings aren't set (then it
// is only queued, as for any registration). With decisions on, a company
// the platform doesn't know yet is only queued after the backfill-style
// registration succeeded: queued alone it would be registered without a
// status and the platform's answer (pending) applied here. A decision staff
// already made in the console is adopted here when decisions are on.
// Never throws for a platform refusal; the result says what happened.
export async function registerDecidedCompany(db, client, companyId, { decisionsOn, source = "registration (console decision)" }) {
  const result = { decisionsOn, configured: !!client };
  if (client) {
    const entry = await backfillCompany(db, client, companyId);
    result.result = entry?.result;
    result.platformStatus = entry?.platformOrganizationStatus ?? null;
    if (entry?.result === "error") result.error = entry.error;
    if (entry?.result === "decided_on_platform" && decisionsOn && entry.platformOrganizationStatus && entry.platformOrganizationStatus !== entry.status) {
      const applied = await applyPlatformDecision(db, { companyId, status: entry.platformOrganizationStatus, source });
      result.adopted = applied.outcome === "applied" ? entry.platformOrganizationStatus : undefined;
    }
  }
  const registered = result.result === "registered" || result.result === "decided_on_platform";
  if (registered || !decisionsOn) {
    await enqueueCompanySync(db, companyId);
    result.queued = true;
  }
  return result;
}
