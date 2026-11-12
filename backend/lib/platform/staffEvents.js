// fleet.staff.created | updated | left (FLEET_HR_CONTRACT.md section 3):
// every person in a Fleet company (owner, team members and drivers) is sent
// to the platform's relay, which hands it to Figbloom HR when HR is on for
// that company. HR keeps them as draft employees mapped by person_id.
//
// They go through the same outbox as companies (PlatformSyncQueue), one row
// per person (kind "staff", localId = User.id, companyId kept on the row).
// What is sent is decided when it is sent:
// - the person is active in that company: "created" the first time (no
//   PlatformLink kind "staff" yet), "updated" after;
// - deactivated, or gone: "left" (only if HR was told about them; the link
//   is then removed, so a reactivation is "created" again).
// The event id is "fleet-staff-<user id>-<row version>": the same on every
// retry of one change (the platform delivers it once), new for each change.
//
// Nothing is queued while HR_INTEGRATION_ENABLED is off; switching it on for
// a company is followed by the staff backfill (scripts/hrStaffBackfill.js).
import { hrIntegrationEnabled } from "./settings.js";
import { ROLE_TITLES } from "../staffRoles.js";

export const STAFF_KIND = "staff";
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;

// A contact address, or null: trimmed, lower-case, and no made-up sign-in
// address (demo and test domains never receive mail).
export function realEmail(address) {
  const a = String(address ?? "").trim().toLowerCase();
  if (!a || a.length > 254 || !EMAIL.test(a)) return null;
  if (/\.(internal|invalid|local|test|example)$/.test(a) || /@example\.(com|org|net)$/.test(a)) return null;
  return a;
}

// person: { id, fullName, phone, email, role }
export function staffEventData(person) {
  return {
    person_id: person.id,
    full_name: String(person.fullName ?? "").trim().slice(0, 200),
    phone: person.phone ? String(person.phone).trim().slice(0, 40) || null : null,
    email: realEmail(person.email),
    role: String(person.role).toLowerCase(),
    job_title: ROLE_TITLES[person.role] ?? String(person.role),
  };
}

export const staffEventId = (userId, version) => `fleet-staff-${userId}-${version}`;
const today = (now) => new Date(now).toISOString().slice(0, 10);

/**
 * One outbox row as POST /events. deps:
 *   client      a PlatformClient (postEvent)
 *   loadPerson  (id) -> { id, companyId, fullName, phone, email, role, status } | null
 *   links       { has(id), set(id), clear(id) }: whether HR was told about the person
 * -> { sent: false } | { sent: true, type }
 */
export async function sendStaffRow(row, { client, loadPerson, links, now = Date.now() }) {
  const person = await loadPerson(row.localId);
  const companyId = row.companyId ?? person?.companyId ?? null;
  if (!companyId) return { sent: false };
  const active = !!person && person.companyId === companyId && person.status === "active" && person.role !== "PLATFORM_ADMIN";
  const known = await links.has(row.localId);
  if (!active && !known) return { sent: false }; // HR never heard of them

  const type = !active ? "left" : known ? "updated" : "created";
  const data = type === "left" ? { person_id: row.localId, left_on: today(now) } : staffEventData(person);
  await client.postEvent({
    type: `fleet.staff.${type}`,
    id: staffEventId(row.localId, row.version),
    occurred_at: new Date(now).toISOString(),
    tenant_local_id: companyId,
    data,
  });
  if (type === "created") await links.set(row.localId);
  if (type === "left") await links.clear(row.localId);
  return { sent: true, type };
}

// ---- the database side

// Queues a person to be (re)sent. One row per person, as for companies: a
// pending row's version goes up, a done row is re-armed. Does nothing while
// HR_INTEGRATION_ENABLED is off.
export async function enqueueStaffSync(db, userId, companyId, { env = process.env, now = new Date() } = {}) {
  if (!hrIntegrationEnabled(env) || !userId || !companyId) return false;
  await db.$executeRaw`
    INSERT INTO "PlatformSyncQueue" ("kind", "localId", "companyId", "nextAttemptAt", "enqueuedAt")
    VALUES (${STAFF_KIND}, ${String(userId)}, ${String(companyId)}, ${now}, ${now})
    ON CONFLICT ("kind", "localId") DO UPDATE SET
      "version" = "PlatformSyncQueue"."version" + 1,
      "companyId" = COALESCE(EXCLUDED."companyId", "PlatformSyncQueue"."companyId"),
      "attempts" = CASE WHEN "PlatformSyncQueue"."doneAt" IS NULL THEN "PlatformSyncQueue"."attempts" ELSE 0 END,
      "nextAttemptAt" = CASE WHEN "PlatformSyncQueue"."doneAt" IS NULL
                             THEN LEAST("PlatformSyncQueue"."nextAttemptAt", EXCLUDED."nextAttemptAt")
                             ELSE EXCLUDED."nextAttemptAt" END,
      "lastError" = CASE WHEN "PlatformSyncQueue"."doneAt" IS NULL THEN "PlatformSyncQueue"."lastError" ELSE NULL END,
      "doneAt" = NULL`;
  return true;
}

// For controllers: a failure is logged, never fails the request (the
// backfill picks up anything missed).
export function enqueueStaffSyncSafely(db, userId, companyId) {
  return enqueueStaffSync(db, userId, companyId).catch((err) =>
    console.error(`[platform] could not queue person ${userId} for HR:`, err.message)
  );
}

export async function loadPersonForSync(db, id) {
  return db.user.findUnique({
    where: { id: String(id) },
    select: { id: true, companyId: true, fullName: true, phone: true, email: true, role: true, status: true },
  });
}

export function prismaStaffLinks(db) {
  const key = (localId) => ({ kind_localId: { kind: STAFF_KIND, localId } });
  return {
    async has(localId) {
      return !!(await db.platformLink.findUnique({ where: key(localId) }));
    },
    async set(localId) {
      await db.platformLink.upsert({ where: key(localId), create: { kind: STAFF_KIND, localId }, update: { registeredAt: new Date() } });
    },
    async clear(localId) {
      await db.platformLink.deleteMany({ where: { kind: STAFF_KIND, localId } });
    },
  };
}

// Everyone HR should know about in one company: the owner, the team and the
// drivers, active only. For the staff backfill.
export async function companyPeople(db, companyId) {
  return db.user.findMany({
    where: { companyId: String(companyId), status: "active", role: { not: "PLATFORM_ADMIN" } },
    select: { id: true, companyId: true, fullName: true, phone: true, email: true, role: true, status: true },
    orderBy: { createdAt: "asc" },
  });
}
