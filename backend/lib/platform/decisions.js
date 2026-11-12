// Applying a Figbloom platform decision (organization.status_changed) to a
// Fleet company: approve (active), reject (rejected), suspend (suspended),
// reactivate (active again). Goes through setCompanyStatus, Fleet's own
// status change, so the approval email and sign-in blocking are as today.
//
// In one transaction:
// - the delivery id is recorded first; a repeat (x-figbloom-delivery seen
//   before) is acknowledged as "duplicate" and not applied again. If anything
//   later fails, the record rolls back with it, so the platform's retry
//   applies it.
// - a decision older (decided_at) than the last one applied is "stale" and
//   not applied over it (the platform retries failed deliveries, so they can
//   arrive out of order).
// - a company already in that status is "unchanged".
// Outcomes: applied | unchanged | duplicate | stale | not_found.
import { setCompanyStatus, notifyCompanyStatusChange, COMPANY_STATUSES } from "../companyStatus.js";

function isUniqueViolation(err) {
  return err?.code === "P2002" || err?.cause?.code === "23505" || /unique constraint/i.test(err?.message ?? "");
}

/**
 * input: { companyId, status, deliveryId?, decidedAt? (Date|null), source }
 * options.notify: what follows an applied change (default: the approval email)
 */
export async function applyPlatformDecision(db, input, { notify = notifyCompanyStatusChange } = {}) {
  const { companyId, status, deliveryId = null, decidedAt = null } = input;
  if (!COMPANY_STATUSES.includes(status)) return { outcome: "invalid" };

  let result;
  try {
    result = await db.$transaction(async (tx) => {
      const record = async (outcome) => {
        if (deliveryId) await tx.platformDecisionDelivery.update({ where: { deliveryId }, data: { outcome } });
      };
      if (deliveryId) {
        // throws on a repeat (unique delivery id): caught below as "duplicate"
        await tx.platformDecisionDelivery.create({ data: { deliveryId, companyId, status, outcome: "received" } });
      }

      const current = await tx.company.findUnique({ where: { id: companyId }, select: { id: true, status: true } });
      if (!current) {
        await record("not_found");
        return { outcome: "not_found" };
      }

      const key = { kind_localId: { kind: "organization", localId: companyId } };
      const link = await tx.platformLink.findUnique({ where: key });
      if (decidedAt && link?.lastDecisionAt && decidedAt < link.lastDecisionAt) {
        await record("stale");
        return { outcome: "stale", status: current.status };
      }
      if (decidedAt) {
        await tx.platformLink.upsert({
          where: key,
          create: { kind: "organization", localId: companyId, lastDecisionAt: decidedAt },
          update: { lastDecisionAt: decidedAt },
        });
      }

      if (current.status === status) {
        await record("unchanged");
        return { outcome: "unchanged", status };
      }
      const change = await setCompanyStatus(tx, companyId, status);
      if (!change) {
        await record("not_found");
        return { outcome: "not_found" };
      }
      await record("applied");
      return { outcome: "applied", status, previous: current.status, change };
    });
  } catch (err) {
    if (deliveryId && isUniqueViolation(err)) return { outcome: "duplicate" };
    throw err;
  }

  if (result.outcome === "applied") {
    notify(db, result.change.before, result.change.company);
    console.log(`[platform] company ${companyId}: ${result.previous} -> ${status} (${input.source ?? "webhook"}${deliveryId ? `, delivery ${deliveryId}` : ""})`);
  }
  const { change, ...answer } = result;
  return answer;
}
