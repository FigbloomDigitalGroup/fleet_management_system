// The database side of the platform outbox (PlatformSyncQueue,
// PlatformLink), for lib/platform/outbox.js and the backfill. db is the
// Prisma client or a transaction.
import { QUEUE_KIND } from "./outbox.js";

const LEASE_MS = 5 * 60 * 1000;

// Times are the app's clock, passed in, never the database's now(): like
// every other DateTime in this schema they are UTC in "timestamp without time
// zone" columns, which the database's now() would only match on a server
// whose time zone is UTC.

// Queues a company to be (re)sent. One row per company: a pending row's
// version goes up (and it is due now), a done row is re-armed. Inside a
// transaction it is part of that write (registration); called on its own
// (enqueueCompanySyncSafely) a failure is only logged, as the backfill
// catches anything missed.
export async function enqueueCompanySync(db, companyId, now = new Date()) {
  await db.$executeRaw`
    INSERT INTO "PlatformSyncQueue" ("kind", "localId", "nextAttemptAt", "enqueuedAt")
    VALUES (${QUEUE_KIND}, ${String(companyId)}, ${now}, ${now})
    ON CONFLICT ("kind", "localId") DO UPDATE SET
      "version" = "PlatformSyncQueue"."version" + 1,
      "attempts" = CASE WHEN "PlatformSyncQueue"."doneAt" IS NULL THEN "PlatformSyncQueue"."attempts" ELSE 0 END,
      "nextAttemptAt" = CASE WHEN "PlatformSyncQueue"."doneAt" IS NULL
                             THEN LEAST("PlatformSyncQueue"."nextAttemptAt", EXCLUDED."nextAttemptAt")
                             ELSE EXCLUDED."nextAttemptAt" END,
      "lastError" = CASE WHEN "PlatformSyncQueue"."doneAt" IS NULL THEN "PlatformSyncQueue"."lastError" ELSE NULL END,
      "doneAt" = NULL`;
}

export function enqueueCompanySyncSafely(db, companyId) {
  return enqueueCompanySync(db, companyId).catch((err) =>
    console.error(`[platform] could not queue company ${companyId}:`, err.message)
  );
}

export function prismaQueue(db) {
  return {
    // Up to `limit` due rows, leased for 5 minutes so an overlapping run skips them.
    async claim(limit, now = new Date()) {
      const rows = await db.$queryRaw`
        WITH due AS (
          SELECT "id" FROM "PlatformSyncQueue"
           WHERE "doneAt" IS NULL AND "nextAttemptAt" <= ${now}
             AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
           ORDER BY "id"
           LIMIT ${Math.max(0, Math.trunc(limit))}
           FOR UPDATE SKIP LOCKED
        )
        UPDATE "PlatformSyncQueue" q
           SET "lockedUntil" = ${new Date(now.getTime() + LEASE_MS)}, "attempts" = q."attempts" + 1
          FROM due WHERE q."id" = due."id"
        RETURNING q."id", q."kind", q."localId", q."companyId", q."version", q."attempts"`;
      return rows.sort((a, b) => a.id - b.id);
    },

    // Sent as it was at `version`; if it changed since, handed back to be sent again at once.
    async done(id, version) {
      const { count } = await db.platformSyncQueue.updateMany({
        where: { id, version, doneAt: null },
        data: { doneAt: new Date(), lockedUntil: null, lastError: null },
      });
      if (count) return true;
      await db.platformSyncQueue.updateMany({ where: { id, doneAt: null }, data: { lockedUntil: null, nextAttemptAt: new Date() } });
      return false;
    },

    async failed(id, error, retryInSeconds) {
      await db.platformSyncQueue.updateMany({
        where: { id, doneAt: null },
        data: {
          lockedUntil: null,
          lastError: String(error).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + retryInSeconds * 1000),
        },
      });
    },
  };
}

export async function recordPlatformLink(db, kind, localId, platformId) {
  await db.platformLink.upsert({
    where: { kind_localId: { kind, localId } },
    create: { kind, localId, platformId },
    update: { registeredAt: new Date(), ...(platformId ? { platformId } : {}) },
  });
}

// A company as the outbox sends it: its first owner's email is the contact.
export async function loadCompanyForSync(db, id) {
  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      users: { where: { role: "COMPANY_OWNER" }, orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
    },
  });
  if (!company) return null;
  const { users, ...rest } = company;
  return { ...rest, ownerEmail: users[0]?.email ?? null };
}
