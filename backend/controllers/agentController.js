import AgentScanLog from "../models/AgentScanLog.js";
import Vehicle from "../models/Vehicle.js";
import { runAiAnomalyScan } from "../services/aiAnomalyDetector.js";
import { answerFleetQuestion } from "../services/fleetAssistant.js";
import { looksLikeRouteRequest, tryHandleRouteRequest } from "../services/routeAssistant.js";

export async function listScans(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const scans = await AgentScanLog.find().sort({ runAt: -1 }).limit(limit);
    return res.json(scans);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch agent scan history" });
  }
}

// ADMIN / COMPANY_OWNER — a company-scoped view of the agent: proof it's
// running (last scan time/status, platform-wide) plus stats limited to this
// company's own vehicles (never another company's findings).
export async function getAgentSummary(req, res) {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const vehicles = await Vehicle.find({ companyId }).select("_id");
    const vehicleIds = new Set(vehicles.map((v) => String(v._id)));

    // A 7-day window, not just "the last 200 scans" — that only covered
    // roughly 2 days at the agent's 15-min cadence, too short to chart a
    // week of activity.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentScans = await AgentScanLog.find({ runAt: { $gte: sevenDaysAgo } }).sort({ runAt: -1 });
    const lastScan = recentScans[0] || (await AgentScanLog.findOne().sort({ runAt: -1 }));

    let scansCoveringFleet = 0;
    let vehicleChecksLogged = 0;
    let anomaliesFound = 0;
    const recentFindings = [];
    const dailyBuckets = new Map(); // "YYYY-MM-DD" -> { vehicleChecks, anomalies }

    for (const scan of recentScans) {
      const relevant = scan.details.filter((d) => vehicleIds.has(String(d.vehicleId)));
      if (relevant.length === 0) continue;

      scansCoveringFleet += 1;
      vehicleChecksLogged += relevant.length;

      const dayKey = scan.runAt.toISOString().slice(0, 10);
      const bucket = dailyBuckets.get(dayKey) || { vehicleChecks: 0, anomalies: 0 };
      bucket.vehicleChecks += relevant.length;

      relevant.forEach((d) => {
        if (d.anomaly) {
          anomaliesFound += 1;
          bucket.anomalies += 1;
        }
        recentFindings.push({
          runAt: scan.runAt,
          vehicleId: d.vehicleId,
          plateNumber: d.plateNumber,
          anomaly: d.anomaly,
          reason: d.reason,
        });
      });

      dailyBuckets.set(dayKey, bucket);
    }

    recentFindings.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());

    // Last 7 calendar days, oldest to newest, zero-filled so the chart shows
    // a continuous week even on days with no matching activity.
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().slice(0, 10);
      const bucket = dailyBuckets.get(dayKey) || { vehicleChecks: 0, anomalies: 0 };
      dailyActivity.push({
        date: dayKey,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        vehicleChecks: bucket.vehicleChecks,
        anomalies: bucket.anomalies,
      });
    }

    return res.json({
      lastScanAt: lastScan?.runAt ?? null,
      lastScanStatus: lastScan?.status ?? null,
      scansCoveringFleet,
      vehicleChecksLogged,
      anomaliesFound,
      recentFindings: recentFindings.slice(0, 10),
      dailyActivity,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch agent summary" });
  }
}

// ADMIN / COMPANY_OWNER — conversational Q&A grounded in this company's own
// fleet data (vehicles, alerts, AI findings, trips). Powers the floating chat
// widget; deliberately separate from the anomaly-detection scan pipeline.
export async function askAboutFleet(req, res) {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "question is required" });
    }
    const trimmed = question.trim();

    if (looksLikeRouteRequest(trimmed)) {
      // Route creation mirrors the Routes page's own permission split
      // (ADMIN manages, COMPANY_OWNER is read-only) — a draft the owner
      // can't save anyway isn't a useful answer.
      if (req.user.role !== "ADMIN") {
        return res.json({ answer: "Only fleet admins can create routes — ask your admin to draw this one." });
      }
      const routeResult = await tryHandleRouteRequest(trimmed);
      if (routeResult) return res.json(routeResult);
    }

    const answer = await answerFleetQuestion(companyId, trimmed);
    return res.json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to answer your question" });
  }
}

export async function triggerScan(req, res) {
  try {
    const log = await runAiAnomalyScan();
    return res.status(201).json(log);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to run agent scan" });
  }
}
