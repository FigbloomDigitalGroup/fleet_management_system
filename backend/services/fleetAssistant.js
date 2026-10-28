import prisma from "../lib/prisma.js";
import { generateText, isAiConfigured } from "./geminiService.js";

const SYSTEM_PREAMBLE = `You are the fleet assistant for a vehicle tracking platform. Answer the user's question using ONLY the fleet data provided below — do not invent vehicles, numbers, or events that aren't in it. If the data doesn't contain enough information to answer, say so plainly instead of guessing. Keep the answer conversational and concise (a few sentences, not a report). Do not use markdown formatting.`;

// Builds a compact text snapshot of one company's fleet — current vehicle
// statuses, recent alerts, recent AI-agent findings, and recent trip
// activity — for the assistant to ground its answer in.
async function buildFleetContext(companyId) {
  const vehicles = await prisma.vehicle.findMany({
    where: { companyId },
    include: { driver: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
  });

  const statusCounts = vehicles.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});

  const vehicleLines = vehicles
    .map((v) => `${v.plateNumber} — status: ${v.status}, driver: ${v.driver?.fullName || "unassigned"}`)
    .join("\n");

  const recentAlerts = await prisma.alert.findMany({
    where: { companyId },
    include: { vehicle: { select: { plateNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const alertLines = recentAlerts.length
    ? recentAlerts
        .map(
          (a) =>
            `${a.createdAt.toISOString()} — ${a.vehicle?.plateNumber || "unknown vehicle"} — ${a.type}: ${a.message} (${a.resolved ? "resolved" : "open"})`
        )
        .join("\n")
    : "No alerts recorded.";

  const vehicleIds = new Set(vehicles.map((v) => v.id));
  const recentScans = await prisma.agentScanLog.findMany({ orderBy: { runAt: "desc" }, take: 50 });
  const findings = [];
  for (const scan of recentScans) {
    for (const d of scan.details) {
      if (vehicleIds.has(String(d.vehicleId))) {
        findings.push({ runAt: scan.runAt, plateNumber: d.plateNumber, anomaly: d.anomaly, reason: d.reason });
      }
    }
  }
  findings.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
  const findingLines = findings.length
    ? findings
        .slice(0, 10)
        .map((f) => `${f.runAt.toISOString()} — ${f.plateNumber} — ${f.anomaly ? "ANOMALY" : "normal"}: ${f.reason}`)
        .join("\n")
    : "No AI agent findings recorded yet.";

  const recentTrips = await prisma.trip.findMany({
    where: { vehicleId: { in: [...vehicleIds] } },
    include: { vehicle: { select: { plateNumber: true } } },
    orderBy: { startTime: "desc" },
    take: 10,
  });

  const tripLines = recentTrips.length
    ? recentTrips
        .map(
          (t) =>
            `${t.vehicle?.plateNumber || "unknown vehicle"} — started ${t.startTime.toISOString()}, ${t.endTime ? `ended ${t.endTime.toISOString()}` : "still in progress"}, distance: ${t.distanceKm ?? "unknown"}km`
        )
        .join("\n")
    : "No trips recorded recently.";

  return `FLEET SNAPSHOT
Total vehicles: ${vehicles.length}
By status: ${Object.entries(statusCounts).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}

VEHICLES
${vehicleLines || "No vehicles registered."}

RECENT ALERTS (most recent first)
${alertLines}

RECENT AI AGENT FINDINGS (most recent first)
${findingLines}

RECENT TRIPS (most recent first)
${tripLines}`;
}

export async function answerFleetQuestion(companyId, question) {
  if (!isAiConfigured()) {
    throw new Error("The AI assistant isn't set up yet — ask your platform admin to add a Gemini API key.");
  }

  const context = await buildFleetContext(companyId);
  const prompt = `${SYSTEM_PREAMBLE}\n\n${context}\n\nQUESTION: ${question}`;
  const answer = await generateText(prompt);
  return answer || "I couldn't come up with an answer for that.";
}
