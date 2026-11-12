// The Figbloom platform's routes into Fleet (FLEET_PLATFORM_CONTRACT.md
// section 2): the signed decision webhook, and the console's company
// summaries.
import prisma from "../lib/prisma.js";
import { makeDecisionWebhookHandler } from "../lib/platform/decisionWebhook.js";
import { applyPlatformDecision } from "../lib/platform/decisions.js";
import { companySummaries } from "../lib/platform/summaries.js";

export const receiveDecision = makeDecisionWebhookHandler({ db: prisma, applyDecision: applyPlatformDecision });

export async function listCompanySummaries(req, res) {
  try {
    const companies = await companySummaries(prisma);
    return res.json({ companies, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[platform] company summaries failed:", err);
    return res.status(500).json({ error: "Failed to build company summaries" });
  }
}

export async function getCompanySummary(req, res) {
  try {
    const [company] = await companySummaries(prisma, { id: req.params.id });
    if (!company) return res.status(404).json({ error: "Company not found", code: "not_found" });
    return res.json({ company, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[platform] company summary failed:", err);
    return res.status(500).json({ error: "Failed to build the company summary" });
  }
}
