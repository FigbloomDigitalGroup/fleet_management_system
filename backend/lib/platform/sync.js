// The every-minute job (Index.js): sends the platform outbox. Does nothing
// (and says so once) until the PLATFORM_* settings are set; the queue simply
// waits. Runs never overlap in this process, and rows are leased in the
// database, so a second server would take other rows or none.
import prisma from "../prisma.js";
import { sharedPlatformClient } from "./client.js";
import { processQueue } from "./outbox.js";
import { prismaQueue, loadCompanyForSync, recordPlatformLink } from "./store.js";
import { applyPlatformDecision } from "./decisions.js";
import { platformDecisionsEnabled } from "./settings.js";
import { sendStaffRow, loadPersonForSync, prismaStaffLinks } from "./staffEvents.js";

let running = false;
let warned = false;

export async function runPlatformSync({ db = prisma, client = sharedPlatformClient(), limit = 50 } = {}) {
  if (!client) {
    if (!warned) console.log("[platform] PLATFORM_API_URL, PLATFORM_TOKEN_URL, PLATFORM_CLIENT_ID or PLATFORM_CLIENT_SECRET not set; companies wait in the queue");
    warned = true;
    return null;
  }
  if (running) return null;
  running = true;
  try {
    return await processQueue({
      queue: prismaQueue(db),
      client,
      loadCompany: (id) => loadCompanyForSync(db, id),
      recordLink: (kind, localId, platformId) => recordPlatformLink(db, kind, localId, platformId),
      decisionsEnabled: platformDecisionsEnabled(),
      // the platform's answer is its decision: applied the same way as a webhook
      adoptStatus: async (company, answer) =>
        (await applyPlatformDecision(db, { companyId: company.id, status: answer.status, source: "registration" })).outcome,
      // fleet.staff.* for Figbloom HR (queued only while HR_INTEGRATION_ENABLED is on)
      sendStaff: (row) => sendStaffRow(row, { client, loadPerson: (id) => loadPersonForSync(db, id), links: prismaStaffLinks(db) }),
      limit,
    });
  } finally {
    running = false;
  }
}
