import AgentScanLog from "../models/AgentScanLog.js";
import Vehicle from "../models/Vehicle.js";
import { runAiAnomalyScan } from "../services/aiAnomalyDetector.js";
import { answerFleetQuestion } from "../services/fleetAssistant.js";

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

    const recentScans = await AgentScanLog.find().sort({ runAt: -1 }).limit(200);
    const lastScan = recentScans[0] || null;

    let scansCoveringFleet = 0;
    let vehicleChecksLogged = 0;
    let anomaliesFound = 0;
    const recentFindings = [];

    for (const scan of recentScans) {
      const relevant = scan.details.filter((d) => vehicleIds.has(String(d.vehicleId)));
      if (relevant.length === 0) continue;

      scansCoveringFleet += 1;
      vehicleChecksLogged += relevant.length;
      relevant.forEach((d) => {
        if (d.anomaly) anomaliesFound += 1;
        recentFindings.push({
          runAt: scan.runAt,
          vehicleId: d.vehicleId,
          plateNumber: d.plateNumber,
          anomaly: d.anomaly,
          reason: d.reason,
        });
      });
    }

    recentFindings.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());

    return res.json({
      lastScanAt: lastScan?.runAt ?? null,
      lastScanStatus: lastScan?.status ?? null,
      scansCoveringFleet,
      vehicleChecksLogged,
      anomaliesFound,
      recentFindings: recentFindings.slice(0, 10),
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

    const answer = await answerFleetQuestion(companyId, question.trim());
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
