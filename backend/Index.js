import "dotenv/config";
import express from "express";
import cron from "node-cron";
import prisma from "./lib/prisma.js";
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import  trackingRoutes from "./routes/trackingRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import geofenceRoutes from "./routes/geofenceRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import inspectionRoutes from "./routes/inspectionRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import platformRoutes from "./routes/platformRoutes.js";
import hrRoutes from "./routes/hrRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import { runAiAnomalyScan } from "./services/aiAnomalyDetector.js";
import { closeStaleTrips, sweepOfflineDevices } from "./controllers/trackingController.js";
import { sweepMaintenanceReminders } from "./controllers/maintenanceController.js";
import { purgeExpiredLocationData } from "./controllers/settingsCompanyController.js";
import { purgeExpiredRecords } from "./lib/cleanup.js";
import { runPlatformSync } from "./lib/platform/sync.js";


import cors from "cors";
import helmet from "helmet";
const app = express();

// Requests reach the API through ngrok and Docker's network, so without
// this every user appears to come from the same internal address — and one
// person's failed logins rate-limited everyone. Only private/loopback hops
// are trusted to report the real client IP (X-Forwarded-For), so a public
// client can't spoof its address. Override with TRUST_PROXY behind other proxies.
app.set("trust proxy", process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal");

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    // Lets the dashboard read the Excel report's filename
    exposedHeaders: ["Content-Disposition"],
  })
);


// The Paystack webhook and the Figbloom platform's decision webhook need
// their own raw-body parsers (billingRoutes.js, platformRoutes.js) for HMAC
// signature verification — express.json() would consume the request stream
// first and leave nothing for them to read, so this skips those paths and
// lets express.json() handle every other route as before.
const RAW_BODY_PATHS = new Set(["/api/billing/webhook", "/api/platform/decisions", "/api/platform/events"]);
app.use((req, res, next) => {
  if (RAW_BODY_PATHS.has(req.originalUrl.split("?")[0])) return next();
  // Photos (base64) and batches of offline-buffered GPS points need more
  // than express's 100kb default.
  // A leave application to Figbloom HR may carry a document of up to 5 MB (base64).
  const path = req.originalUrl.split("?")[0];
  const limit = req.originalUrl.startsWith("/api/uploads") ? "4mb" : path === "/api/hr/my/leave/applications" ? "8mb" : "1mb";
  express.json({ limit })(req, res, next);
});
// /healthz is the same check under the name AWS's load balancer polls
// (figbloom-platform FleetBackend stack). It answers without touching the
// database, so a slow query never marks the server unhealthy.
app.get(["/health", "/healthz"], (req, res) => {
  res.json({ status: "ok", server: "running" })
});

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/geofences", geofenceRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/inspections", inspectionRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/invitations", invitationRoutes);



app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;

// Fail fast if the database (PostgreSQL — Supabase in production) can't be
// reached, rather than starting a server whose every request would error.
async function connectDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "Failed to connect to PostgreSQL: DATABASE_URL is not set. Add it to the environment (Render → Environment) — the Supabase session pooler connection string."
    );
    process.exit(1);
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("PostgreSQL connected");
  } catch (err) {
    // Prisma puts the database's own reason in meta, not always the message.
    const reason = err.meta?.driverAdapterError?.cause;
    console.error("Failed to connect to PostgreSQL:", err.message, reason ? JSON.stringify(reason) : "");
    process.exit(1);
  }
}

connectDatabase().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port:${PORT}`);
  });

  // AI anomaly agent — runs every 15 minutes, independent of the real-time
  // fixed-threshold checks in trackingController.js.
  cron.schedule("*/15 * * * *", () => {
    runAiAnomalyScan()
      .then((log) =>
        console.log(
          `[agent] scan complete — ${log.vehiclesScanned} vehicle(s), ${log.anomaliesFound} anomaly/anomalies (${log.status})`
        )
      )
      .catch((err) => console.error("[agent] scan crashed:", err));
  });

  // Closes out trips whose vehicle has gone quiet, independent of whether
  // another ping ever arrives to trigger the reactive close in
  // trackingController.js's ingestLocation.
  cron.schedule("*/5 * * * *", () => {
    closeStaleTrips()
      .then((count) => {
        if (count > 0) console.log(`[trips] closed ${count} stale trip(s)`);
      })
      .catch((err) => console.error("[trips] stale-trip sweep crashed:", err));
  });

  // Phones/trackers that went silent without saying so (app killed, phone
  // off, battery dead) — see sweepOfflineDevices.
  cron.schedule("*/5 * * * *", () => {
    sweepOfflineDevices()
      .then((n) => n > 0 && console.log(`[devices] flagged ${n} offline device(s)`))
      .catch((err) => console.error("[devices] offline sweep crashed:", err));
  });

  // Service reminders that came due by date or mileage.
  cron.schedule("0 * * * *", () => {
    sweepMaintenanceReminders()
      .then((n) => n > 0 && console.log(`[maintenance] ${n} reminder(s) due`))
      .catch((err) => console.error("[maintenance] reminder sweep crashed:", err));
  });

  // Old resolved alerts (kept at least 90 days, see lib/cleanup.js) and
  // expired sign-in tokens. Hourly is plenty for both.
  cron.schedule("17 * * * *", () => {
    purgeExpiredRecords().catch((err) => console.error("[cleanup] purge crashed:", err));
  });

  // Figbloom platform: sends companies created, renamed or changed to the
  // platform (the PlatformSyncQueue outbox; lib/platform/sync.js). Does
  // nothing until the PLATFORM_* settings are set.
  cron.schedule("* * * * *", () => {
    runPlatformSync()
      .then((r) => r && (r.sent || r.failed.length) && console.log(`[platform] sent ${r.sent}, failed ${r.failed.length}, deferred ${r.deferred}, adopted ${r.adopted}`))
      .catch((err) => console.error("[platform] sync crashed:", err));
  });

  // Data retention — nightly at 02:30 Nairobi time.
  cron.schedule(
    "30 2 * * *",
    () => {
      purgeExpiredLocationData()
        .then((n) => n > 0 && console.log(`[retention] deleted ${n} expired location record(s)`))
        .catch((err) => console.error("[retention] purge crashed:", err));
    },
    { timezone: "Africa/Nairobi" }
  );
});






