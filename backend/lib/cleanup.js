import prisma from "./prisma.js";

// Resolved alerts are kept this long after resolving, then deleted.
export const RESOLVED_ALERT_TTL_MINUTES = 30;

// Does what MongoDB's TTL indexes used to: deletes resolved alerts 30
// minutes after they were resolved, and refresh tokens once they expire.
// Runs on a schedule from Index.js. Returns how many rows went.
export async function purgeExpiredRecords(now = new Date()) {
  const [alerts, tokens] = await Promise.all([
    prisma.alert.deleteMany({
      where: { resolvedAt: { lt: new Date(now.getTime() - RESOLVED_ALERT_TTL_MINUTES * 60000) } },
    }),
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return alerts.count + tokens.count;
}
