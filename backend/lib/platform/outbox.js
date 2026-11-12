// Sending the registration outbox (PlatformSyncQueue) to the Figbloom
// platform: for each queued company, PUT its organisation, then its tenant
// (the same local id, under that organisation), then mark the row done.
//
// Kept free of Prisma so it can be tested with an in-memory queue: the
// queue, the company reader and the link writer are passed in
// (lib/platform/store.js has the database versions).
//
// Rules (the same as Figbloom Schools' platform_sync_queue):
// - Retry with backoff: 1, 2, 4, 8 ... minutes after each failed attempt, at
//   most an hour, for as long as it takes.
// - If the platform (or its sign-in) can't be reached, the rest of the batch
//   is handed back for a minute rather than each waiting out its timeout.
// - A row completes only if its version is still the one it was claimed at;
//   a change made meanwhile sends the company again at once.
import { PlatformError } from "./client.js";

export const QUEUE_KIND = "company";
const DEFER_SECONDS = 60;
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// 60 s after the first failed attempt, doubling, at most an hour.
export function backoffSeconds(attempts) {
  return Math.min(3600, 60 * 2 ** Math.max(Number(attempts) - 1 || 0, 0));
}

// Fleet's company status as the platform names it (the same four words).
export function platformStatusOf(status) {
  return ["active", "suspended", "rejected"].includes(status) ? status : "pending";
}

// company: { id, name, slug, status, createdAt, ownerEmail }
export function organizationBody(company) {
  const email = company.ownerEmail?.trim().toLowerCase();
  return {
    name: String(company.name).trim().slice(0, 200),
    owner_email: email && email.length <= 254 && EMAIL.test(email) ? email : null,
    created_at: new Date(company.createdAt).toISOString(),
  };
}

export function tenantBody(company) {
  return {
    name: String(company.name).trim().slice(0, 200),
    // the platform makes its own from the name when Fleet's doesn't fit its rules
    ...(SLUG.test(company.slug ?? "") ? { slug: company.slug } : {}),
    organization_local_id: company.id,
    created_at: new Date(company.createdAt).toISOString(),
  };
}

function isOutage(err) {
  return err instanceof PlatformError && (err.status === 0 || err.status >= 500 || err.code === "token_failed");
}

/**
 * Sends what is due. deps:
 *   queue        { claim(limit), done(id, version) -> boolean, failed(id, error, retryInSeconds) }
 *   client       a PlatformClient
 *   loadCompany  (id) -> { id, name, slug, status, createdAt, ownerEmail } | null
 *   recordLink   (kind, localId, platformId)
 *   decisionsEnabled  boolean
 *   adoptStatus  optional (company, organizationAnswer) -> outcome: with decisions on, the platform's answer is its
 *                decision (a new company is pending there, or active with auto-approve), applied like a webhook
 *   sendStaff    optional (row) -> { sent }: a "staff" row as a fleet.staff.* event (lib/platform/staffEvents.js)
 */
export async function processQueue({ queue, client, loadCompany, recordLink, decisionsEnabled = false, adoptStatus, sendStaff, limit = 50, log = console }) {
  const rows = await queue.claim(limit);
  const report = { claimed: rows.length, sent: 0, failed: [], deferred: 0, adopted: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (row.kind === "staff" && sendStaff) {
        const result = await sendStaff(row);
        await queue.done(row.id, row.version);
        if (result?.sent) report.sent++;
        continue;
      }
      if (row.kind !== QUEUE_KIND) {
        await queue.failed(row.id, `unknown kind ${row.kind}`, 3600);
        report.failed.push({ localId: row.localId, error: "unknown_kind" });
        continue;
      }
      const company = await loadCompany(row.localId);
      if (!company) {
        await queue.done(row.id, row.version); // deleted since it was queued
        continue;
      }
      const org = await client.putOrganization(company.id, organizationBody(company));
      await recordLink("organization", company.id, org?.organization_id ?? null);
      const tenant = await client.putTenant(company.id, tenantBody(company));
      await recordLink("tenant", company.id, tenant?.tenant_id ?? tenant?.id ?? null);
      // false: it changed while on its way and is handed back to be sent again
      await queue.done(row.id, row.version);
      report.sent++;
      if (decisionsEnabled && adoptStatus && org?.status && org.status !== company.status) {
        if ((await adoptStatus(company, org)) === "applied") report.adopted++;
      }
    } catch (err) {
      const message = err?.message || String(err);
      log.error(`[platform] ${row.kind === "staff" ? "person" : "company"} ${row.localId} not sent (attempt ${row.attempts}): ${message}`);
      await queue.failed(row.id, message, backoffSeconds(row.attempts));
      report.failed.push({ localId: row.localId, error: message });
      if (isOutage(err)) {
        for (const rest of rows.slice(i + 1)) {
          await queue.failed(rest.id, `deferred: ${message}`, DEFER_SECONDS);
          report.deferred++;
        }
        break;
      }
    }
  }
  return report;
}
