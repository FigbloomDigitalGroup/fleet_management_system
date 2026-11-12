import prisma from "./prisma.js";

// Resolved alerts are incident history (for the fleet manager, insurers,
// disputes), so they are kept: at least this many days after resolving, or
// the company's own data-retention period if that is longer.
export const RESOLVED_ALERT_MIN_RETENTION_DAYS = 90;

export function resolvedAlertRetentionDays(companyRetentionDays) {
  return Math.max(RESOLVED_ALERT_MIN_RETENTION_DAYS, Number(companyRetentionDays) || 0);
}

// Does what MongoDB's TTL indexes used to: deletes resolved alerts once
// they're older than their company's retention (never sooner than 90 days),
// and refresh tokens once they expire. Runs on a schedule from Index.js.
// Returns how many rows went.
export async function purgeExpiredRecords(now = new Date()) {
  const companies = await prisma.company.findMany({ select: { id: true, dataRetentionDays: true } });
  let alerts = 0;
  for (const c of companies) {
    const cutoff = new Date(now.getTime() - resolvedAlertRetentionDays(c.dataRetentionDays) * 86400000);
    const { count } = await prisma.alert.deleteMany({
      where: { companyId: c.id, resolved: true, resolvedAt: { lt: cutoff } },
    });
    alerts += count;
  }
  const tokens = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
  return alerts + tokens.count;
}
