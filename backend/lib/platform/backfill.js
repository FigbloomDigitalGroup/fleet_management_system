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
import { loadCompanyForSync, recordPlatformLink } from "./store.js";

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
      const company = await loadCompanyForSync(db, id);
      if (!company) continue;
      const entry = { id, name: company.name, status: company.status, platformStatus: platformStatusOf(company.status), ownerEmail: company.ownerEmail };
      report.companies.push(entry);
      if (dryRun) continue;
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
        report.errors.push({ id, error: err?.message || String(err) });
      }
    }
    if (page.length < PAGE) break;
    cursor = page[page.length - 1].id;
  }
  return report;
}
