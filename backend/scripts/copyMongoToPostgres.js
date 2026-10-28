// Copies every MongoDB collection into the PostgreSQL tables from
// prisma/schema.prisma. Each row keeps its Mongo ObjectId (as a hex string)
// so existing links, upload URLs and ids cached on phones keep working.
//
// The target tables are emptied first, so it can be re-run any number of
// times. Mongo is only read, never written.
//
//   node scripts/copyMongoToPostgres.js            # local DATABASE_URL only
//   node scripts/copyMongoToPostgres.js --remote   # allow a non-local target
import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";
import prisma from "../lib/prisma.js";
import { ALERT_SETTING_DEFAULTS, TRACKING_HOURS_DEFAULTS } from "../lib/companySettings.js";

const target = new URL(process.env.DATABASE_URL);
const isLocal = ["localhost", "127.0.0.1", "postgres"].includes(target.hostname);
if (!isLocal && !process.argv.includes("--remote")) {
  console.error(`Refusing to overwrite ${target.hostname} — pass --remote to copy into a non-local database.`);
  process.exit(1);
}

// ── Value conversion ────────────────────────────────────────────────────────

const isObjectId = (v) => v?._bsontype === "ObjectId" || v?._bsontype === "ObjectID";
const id = (v) => (v == null ? null : isObjectId(v) ? v.toHexString() : String(v));
const date = (v) => (v == null ? null : new Date(v));
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const int = (v) => (num(v) == null ? null : Math.round(Number(v)));
const def = (v, fallback) => (v === undefined || v === null ? fallback : v);

// Embedded documents → plain JSON: ObjectIds become hex strings, dates ISO
// strings, and Mongo's per-subdocument _id is dropped.
function json(v) {
  if (v == null) return v ?? null;
  if (isObjectId(v)) return v.toHexString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(json);
  if (typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) if (k !== "_id" && k !== "__v") out[k] = json(val);
    return out;
  }
  return v;
}

const stamps = (d) => ({ createdAt: date(d.createdAt) ?? undefined, updatedAt: date(d.updatedAt) ?? undefined });

// ── Per-table mapping (Mongo document → Prisma row) ─────────────────────────

const tables = [
  {
    collection: "companies",
    model: "company",
    // logoUploadId is set after uploads are copied (uploads reference companies).
    map: (d) => ({
      id: id(d._id),
      name: d.name,
      slug: d.slug,
      status: def(d.status, "pending"),
      subscriptionPlan: def(d.subscriptionPlan, "trial"),
      trialEndsAt: date(d.trialEndsAt),
      industry: def(d.industry, "other"),
      paymentMethod: d.paymentMethod ?? null,
      totalRevenue: def(num(d.totalRevenue), 0),
      dailyStartPoint: d.dailyStartPoint ? json(d.dailyStartPoint) : undefined,
      // Mongoose filled missing settings with schema defaults; store them.
      alertSettings: { ...ALERT_SETTING_DEFAULTS, ...json(d.alertSettings ?? {}) },
      trackingHours: { ...TRACKING_HOURS_DEFAULTS, ...json(d.trackingHours ?? {}) },
      dataRetentionDays: def(int(d.dataRetentionDays), 180),
      ...stamps(d),
    }),
  },
  {
    collection: "users",
    model: "user",
    // avatarUploadId is set after uploads are copied.
    map: (d) => ({
      id: id(d._id),
      email: String(d.email).trim().toLowerCase(),
      passwordHash: d.passwordHash,
      fullName: d.fullName,
      role: d.role,
      companyId: id(d.companyId),
      adminAccess: def(d.adminAccess, "full"),
      consentAcceptedAt: date(d.trackingConsent?.acceptedAt),
      consentVersion: d.trackingConsent?.version ?? null,
      status: def(d.status, "active"),
      resetPasswordTokenHash: d.resetPasswordTokenHash ?? null,
      resetPasswordExpires: date(d.resetPasswordExpires),
      phone: d.phone ?? null,
      dob: d.dob ?? null,
      nationalId: d.nationalId ?? null,
      address: d.address ?? null,
      licenseNumber: d.licenseNumber ?? null,
      licenseExpiry: d.licenseExpiry ?? null,
      emergencyName: d.emergencyName ?? null,
      emergencyPhone: d.emergencyPhone ?? null,
      ...stamps(d),
    }),
    refs: { companyId: "company" },
  },
  {
    collection: "uploads",
    model: "upload",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      uploadedById: id(d.uploadedBy),
      kind: d.kind,
      contentType: d.contentType,
      sizeBytes: int(d.sizeBytes),
      data: Buffer.from(d.data?.buffer ?? d.data ?? []),
      ...stamps(d),
    }),
    required: { companyId: "company", uploadedById: "user" },
  },
  {
    collection: "geofences",
    model: "geofence",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      name: d.name,
      type: d.type,
      centerLat: num(d.centerLat),
      centerLng: num(d.centerLng),
      radiusM: num(d.radiusM),
      polygon: json(d.polygon ?? []),
      ...stamps(d),
    }),
    required: { companyId: "company" },
  },
  {
    collection: "vehicles",
    model: "vehicle",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      plateNumber: d.plateNumber,
      make: d.make ?? null,
      model: d.model ?? null,
      deviceId: d.deviceId ?? null,
      trackerToken: d.trackerToken ?? null,
      vehicleType: def(d.vehicleType, "car"),
      status: def(d.status, "offline"),
      statusManuallySet: def(d.statusManuallySet, false),
      driverId: id(d.driverId),
      startGeofenceId: id(d.startGeofenceId),
      fuelCapacityLiters: def(num(d.fuelCapacityLiters), 60),
      avgConsumptionLPer100Km: def(num(d.avgConsumptionLPer100Km), 12),
      odometerBaseKm: def(num(d.odometerBaseKm), 0),
      device: d.device ? json(d.device) : undefined,
      ...stamps(d),
    }),
    required: { companyId: "company" },
    refs: { driverId: "user", startGeofenceId: "geofence" },
  },
  {
    collection: "refreshtokens",
    model: "refreshToken",
    map: (d) => ({
      id: id(d._id),
      userId: id(d.userId),
      tokenHash: d.tokenHash,
      expiresAt: date(d.expiresAt),
      revoked: def(d.revoked, false),
      ...stamps(d),
    }),
    required: { userId: "user" },
  },
  {
    collection: "platformsettings",
    model: "platformSettings",
    map: (d) => ({
      id: id(d._id),
      requireManualApproval: def(d.requireManualApproval, true),
      defaultPlan: def(d.defaultPlan, "trial"),
      trialDays: def(int(d.trialDays), 14),
      vehicleLimits: d.vehicleLimits ? json(d.vehicleLimits) : undefined,
      supportEmail: def(d.supportEmail, "support@getour.com"),
      ...stamps(d),
    }),
  },
  {
    collection: "locationpings",
    model: "locationPing",
    map: (d) => ({
      id: id(d._id),
      vehicleId: id(d.vehicleId),
      latitude: num(d.latitude),
      longitude: num(d.longitude),
      speedKph: num(d.speedKph),
      heading: num(d.heading),
      fuelLevelLiters: num(d.fuelLevelLiters),
      accuracyM: num(d.accuracyM),
      isMocked: def(d.isMocked, false),
      source: def(d.source, "manual"),
      recordedAt: date(d.recordedAt) ?? d._id.getTimestamp(),
    }),
    required: { vehicleId: "vehicle" },
  },
  {
    collection: "trips",
    model: "trip",
    map: (d) => ({
      id: id(d._id),
      vehicleId: id(d.vehicleId),
      driverId: id(d.driverId),
      startTime: date(d.startTime),
      endTime: date(d.endTime),
      startLat: num(d.startLat),
      startLng: num(d.startLng),
      endLat: num(d.endLat),
      endLng: num(d.endLng),
      distanceKm: num(d.distanceKm),
      purpose: d.purpose ?? null,
      note: String(d.note ?? "").slice(0, 500),
      endedBy: d.endedBy ?? null,
      ...stamps(d),
    }),
    required: { vehicleId: "vehicle" },
    refs: { driverId: "user" },
  },
  {
    collection: "drivingevents",
    model: "drivingEvent",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      vehicleId: id(d.vehicleId),
      driverId: id(d.driverId),
      type: d.type,
      source: d.source,
      value: num(d.value),
      speedKph: num(d.speedKph),
      latitude: num(d.latitude),
      longitude: num(d.longitude),
      recordedAt: date(d.recordedAt),
      ...stamps(d),
    }),
    required: { companyId: "company", vehicleId: "vehicle" },
    refs: { driverId: "user" },
  },
  {
    collection: "alerts",
    model: "alert",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      vehicleId: id(d.vehicleId),
      type: d.type,
      message: d.message,
      resolved: def(d.resolved, false),
      hiddenForDriverAt: date(d.hiddenForDriverAt),
      resolvedAt: date(d.resolvedAt),
      ...stamps(d),
    }),
    required: { companyId: "company", vehicleId: "vehicle" },
  },
  {
    collection: "routes",
    model: "route",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      vehicleId: id(d.vehicleId),
      name: d.name,
      waypoints: json(d.waypoints ?? []),
      toleranceMeters: def(num(d.toleranceMeters), 300),
      speedLimitKph: num(d.speedLimitKph),
      active: def(d.active, true),
      frequency: def(d.frequency, "daily"),
      daysOfWeek: (d.daysOfWeek ?? []).map(int),
      source: def(d.source, "manual"),
      ...stamps(d),
    }),
    required: { companyId: "company", vehicleId: "vehicle" },
  },
  {
    collection: "routecompletions",
    model: "routeCompletion",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      routeId: id(d.routeId),
      vehicleId: id(d.vehicleId),
      driverId: id(d.driverId),
      dateKey: d.dateKey,
      completedAt: date(d.completedAt) ?? undefined,
      ...stamps(d),
    }),
    required: { companyId: "company", routeId: "route", vehicleId: "vehicle" },
    refs: { driverId: "user" },
  },
  {
    collection: "jobs",
    model: "job",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      driverId: id(d.driverId),
      vehicleId: id(d.vehicleId),
      title: d.title,
      address: d.address,
      latitude: num(d.latitude),
      longitude: num(d.longitude),
      contactName: d.contactName ?? null,
      contactPhone: d.contactPhone ?? null,
      notes: d.notes ?? null,
      scheduledDate: d.scheduledDate,
      windowStart: date(d.windowStart),
      windowEnd: date(d.windowEnd),
      sequence: def(int(d.sequence), 0),
      status: def(d.status, "assigned"),
      failureReason: d.failureReason ?? null,
      startedAt: date(d.startedAt),
      arrivedAt: date(d.arrivedAt),
      completedAt: date(d.completedAt),
      failedAt: date(d.failedAt),
      proof: d.proof ? json(d.proof) : undefined,
      trackingToken: d.trackingToken,
      createdById: id(d.createdBy),
      ...stamps(d),
    }),
    required: { companyId: "company" },
    refs: { driverId: "user", vehicleId: "vehicle", createdById: "user" },
  },
  {
    collection: "messages",
    model: "message",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      driverId: id(d.driverId),
      senderId: id(d.senderId),
      fromDriver: Boolean(d.fromDriver),
      body: String(d.body).slice(0, 2000),
      readAt: date(d.readAt),
      hiddenForDriverAt: date(d.hiddenForDriverAt),
      ...stamps(d),
    }),
    required: { companyId: "company", driverId: "user", senderId: "user" },
  },
  {
    collection: "expenses",
    model: "expense",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      vehicleId: id(d.vehicleId),
      driverId: id(d.driverId),
      category: d.category,
      amount: num(d.amount),
      note: d.note ?? null,
      incurredAt: date(d.incurredAt) ?? undefined,
      receiptUploadId: id(d.receiptUploadId),
      ...stamps(d),
    }),
    required: { companyId: "company", vehicleId: "vehicle" },
    refs: { driverId: "user", receiptUploadId: "upload" },
  },
  {
    collection: "inspections",
    model: "inspection",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      vehicleId: id(d.vehicleId),
      driverId: id(d.driverId),
      items: json(d.items ?? []),
      passed: Boolean(d.passed),
      odometerKm: num(d.odometerKm),
      notes: d.notes ?? null,
      latitude: num(d.latitude),
      longitude: num(d.longitude),
      ...stamps(d),
    }),
    required: { companyId: "company", vehicleId: "vehicle", driverId: "user" },
  },
  {
    collection: "maintenancerecords",
    model: "maintenanceRecord",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      vehicleId: id(d.vehicleId),
      kind: d.kind,
      title: d.title,
      notes: d.notes ?? null,
      performedAt: date(d.performedAt),
      odometerKm: num(d.odometerKm),
      costKes: num(d.costKes),
      dueDate: date(d.dueDate),
      dueOdometerKm: num(d.dueOdometerKm),
      intervalDays: int(d.intervalDays),
      intervalKm: num(d.intervalKm),
      status: def(d.status, "open"),
      alertedAt: date(d.alertedAt),
      ...stamps(d),
    }),
    required: { companyId: "company", vehicleId: "vehicle" },
  },
  {
    collection: "transactions",
    model: "transaction",
    map: (d) => ({
      id: id(d._id),
      companyId: id(d.companyId),
      plan: d.plan,
      reference: d.reference,
      amount: num(d.amount),
      currency: def(d.currency, "KES"),
      status: def(d.status, "pending"),
      channel: d.channel ?? null,
      paidAt: date(d.paidAt),
      ...stamps(d),
    }),
    required: { companyId: "company" },
  },
  {
    collection: "agentscanlogs",
    model: "agentScanLog",
    map: (d) => ({
      id: id(d._id),
      runAt: date(d.runAt) ?? d._id.getTimestamp(),
      vehiclesScanned: def(int(d.vehiclesScanned), 0),
      anomaliesFound: def(int(d.anomaliesFound), 0),
      status: def(d.status, "success"),
      errorMessage: d.errorMessage ?? null,
      details: json(d.details ?? []),
    }),
  },
];

// ── Copy ────────────────────────────────────────────────────────────────────

// mongodb+srv:// needs an SRV DNS lookup that some local resolvers refuse;
// public resolvers handle it.
dns.setServers(["8.8.8.8", "1.1.1.1"]);
await mongoose.connect(process.env.MONGODB_URI);
const mongo = mongoose.connection.db;

// Ids copied so far per model, to drop rows that point at missing parents
// (Mongo never enforced references) and null out dangling optional links.
const seen = {};
const report = [];

// Empty every table in one statement (CASCADE handles the foreign keys).
const tableNames = await prisma.$queryRawUnsafe(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
);
await prisma.$executeRawUnsafe(`TRUNCATE ${tableNames.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

for (const t of tables) {
  seen[t.model] = new Set();
  const rows = [];
  let orphans = 0;
  let unlinked = 0;
  for await (const doc of mongo.collection(t.collection).find({})) {
    const row = t.map(doc);
    if (Object.entries(t.required ?? {}).some(([field, model]) => !seen[model].has(row[field]))) {
      orphans++;
      continue;
    }
    for (const [field, model] of Object.entries(t.refs ?? {})) {
      if (row[field] && !seen[model].has(row[field])) {
        row[field] = null;
        unlinked++;
      }
    }
    rows.push(row);
  }

  let failed = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    try {
      await prisma[t.model].createMany({ data: batch });
      batch.forEach((r) => seen[t.model].add(r.id));
    } catch {
      // Find the bad row(s) one at a time so one bad document doesn't lose the batch.
      for (const r of batch) {
        try {
          await prisma[t.model].create({ data: r });
          seen[t.model].add(r.id);
        } catch (err) {
          failed++;
          console.warn(`  ${t.collection} ${r.id} skipped: ${err.message.split("\n").filter(Boolean).pop()}`);
        }
      }
    }
  }
  report.push({ collection: t.collection, copied: seen[t.model].size, orphansSkipped: orphans, linksCleared: unlinked, failed });
}

// Logos and avatars, now that the uploads exist.
for await (const c of mongo.collection("companies").find({ logoUploadId: { $ne: null } })) {
  if (seen.upload.has(id(c.logoUploadId)) && seen.company.has(id(c._id)))
    await prisma.company.update({ where: { id: id(c._id) }, data: { logoUploadId: id(c.logoUploadId), updatedAt: c.updatedAt } });
}
for await (const u of mongo.collection("users").find({ avatarUploadId: { $ne: null } })) {
  if (seen.upload.has(id(u.avatarUploadId)) && seen.user.has(id(u._id)))
    await prisma.user.update({ where: { id: id(u._id) }, data: { avatarUploadId: id(u.avatarUploadId), updatedAt: u.updatedAt } });
}

console.table(report);
await prisma.$disconnect();
await mongoose.disconnect();
