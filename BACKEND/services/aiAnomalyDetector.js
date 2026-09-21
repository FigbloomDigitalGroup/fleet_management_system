import Vehicle from "../models/Vehicle.js";
import LocationPing from "../models/LocationPing.js";
import Trip from "../models/Trip.js";
import Alert from "../models/Alert.js";
import AgentScanLog from "../models/AgentScanLog.js";
import { askOllama, isOllamaReachable } from "./ollamaService.js";

const LOOKBACK_MINUTES = 15;

const PROMPT_INSTRUCTIONS = `You are a fleet safety analyst. Given a vehicle's recent GPS ping and trip history, decide if there is an unusual behavioral pattern worth flagging — e.g. erratic or oscillating speed changes, unusual trip timing, or behavior inconsistent with this vehicle's own recent history. Do NOT flag simple speeding or a stationary vehicle — those are already handled by separate fixed-threshold checks. Respond with strict JSON only, no markdown, no extra commentary, in exactly this shape: {"anomaly": true or false, "reason": "one short sentence"}`;

function buildVehicleSummary(vehicle, pings, trips) {
  const speeds = pings.map((p) => p.speedKph ?? 0);
  const avgSpeed = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : "0";
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const minSpeed = speeds.length ? Math.min(...speeds) : 0;

  const pingLines = pings
    .map((p) => `${p.recordedAt.toISOString()} speed=${p.speedKph ?? "?"}kph fuel=${p.fuelLevelLiters ?? "n/a"}L`)
    .join("\n");

  const tripLines = trips.length
    ? trips
        .map(
          (t) =>
            `start=${t.startTime.toISOString()} end=${t.endTime ? t.endTime.toISOString() : "in progress"} distance=${t.distanceKm ?? "?"}km`
        )
        .join("\n")
    : "no trips started in this window";

  return `Vehicle ${vehicle.plateNumber} — last ${LOOKBACK_MINUTES} minutes:
Pings (${pings.length}): avg speed ${avgSpeed}kph, min ${minSpeed}kph, max ${maxSpeed}kph
${pingLines || "no pings"}

Trips:
${tripLines}`;
}

// Runs one full scan pass: pulls every vehicle with a GPS ping in the last
// LOOKBACK_MINUTES minutes, asks the local Ollama model whether its recent
// behavior looks unusual, raises an `ai_pattern_anomaly` Alert for positive
// hits, and always persists an AgentScanLog — including a "no anomaly" entry
// per vehicle checked, and a "failed" log (with the error) if Ollama itself
// is unreachable, rather than throwing out of the cron job.
export async function runAiAnomalyScan() {
  const runAt = new Date();

  const reachable = await isOllamaReachable();
  if (!reachable) {
    return AgentScanLog.create({
      runAt,
      vehiclesScanned: 0,
      anomaliesFound: 0,
      status: "failed",
      errorMessage: `Ollama is unreachable at ${process.env.OLLAMA_URL || "http://localhost:11434"}`,
      details: [],
    });
  }

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  const details = [];

  try {
    const recentVehicleIds = await LocationPing.distinct("vehicleId", { recordedAt: { $gte: since } });
    const vehicles = await Vehicle.find({ _id: { $in: recentVehicleIds } });

    for (const vehicle of vehicles) {
      const [pings, trips] = await Promise.all([
        LocationPing.find({ vehicleId: vehicle._id, recordedAt: { $gte: since } }).sort({ recordedAt: 1 }),
        Trip.find({ vehicleId: vehicle._id, startTime: { $gte: since } }),
      ]);

      const summary = buildVehicleSummary(vehicle, pings, trips);

      try {
        const result = await askOllama(`${PROMPT_INSTRUCTIONS}\n\n${summary}`);
        const anomaly = Boolean(result?.anomaly);
        const reason = typeof result?.reason === "string" ? result.reason : "";

        details.push({ vehicleId: vehicle._id, plateNumber: vehicle.plateNumber, anomaly, reason });

        if (anomaly) {
          await Alert.create({
            companyId: vehicle.companyId,
            vehicleId: vehicle._id,
            type: "ai_pattern_anomaly",
            message: reason || "AI agent flagged an unusual pattern for this vehicle.",
          });
        }
      } catch (perVehicleErr) {
        // One vehicle's model call failing (bad JSON, timeout, etc.) shouldn't
        // sink the whole run — record it and keep going.
        details.push({
          vehicleId: vehicle._id,
          plateNumber: vehicle.plateNumber,
          anomaly: false,
          reason: `Skipped — ${perVehicleErr.message}`,
        });
      }
    }

    return AgentScanLog.create({
      runAt,
      vehiclesScanned: details.length,
      anomaliesFound: details.filter((d) => d.anomaly).length,
      status: "success",
      errorMessage: null,
      details,
    });
  } catch (err) {
    return AgentScanLog.create({
      runAt,
      vehiclesScanned: details.length,
      anomaliesFound: details.filter((d) => d.anomaly).length,
      status: "failed",
      errorMessage: err.message,
      details,
    });
  }
}




