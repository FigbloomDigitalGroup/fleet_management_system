import "dotenv/config";
import express from "express";
import cron from "node-cron";
import { connectDB } from "./config/db.js";
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
import { runAiAnomalyScan } from "./services/aiAnomalyDetector.js";
import { closeStaleTrips } from "./controllers/trackingController.js";


import cors from "cors";
import helmet from "helmet";
const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);


app.use(express.json());
app.get("/health", (req, res) => {
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



app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
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
});






