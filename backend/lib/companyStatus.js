// Changing a company's status: the one place both Fleet's own /platform
// approve/suspend (while it still decides) and the Figbloom platform's
// decision webhook go through, so the emails and sign-in blocking behave the
// same either way. Sign-in reads Company.status (authController.login:
// pending, suspended and rejected companies can't sign in).
import { sendCompanyApprovedEmail } from "./mailer.js";

export const COMPANY_STATUSES = ["active", "suspended", "pending", "rejected"];

// Sets the status; { before, company } or null when there's no such company.
// db is the Prisma client or a transaction.
export async function setCompanyStatus(db, id, status) {
  const before = await db.company.findUnique({ where: { id: String(id) }, select: { id: true, status: true } });
  if (!before) return null;
  const { count } = await db.company.updateMany({ where: { id: String(id) }, data: { status } });
  if (!count) return null;
  const company = await db.company.findUnique({ where: { id: String(id) } });
  return { before, company };
}

// What follows a change, once it is saved: the owner(s) of a waiting company
// that was approved get the approval email. In the background, so an email
// problem never blocks or undoes the change.
export function notifyCompanyStatusChange(db, before, company) {
  if (before?.status === "pending" && company?.status === "active") {
    db.membership
      .findMany({ where: { companyId: company.id, role: "COMPANY_OWNER" }, select: { user: { select: { email: true } } } })
      .then((owners) => owners.length && sendCompanyApprovedEmail(owners.map((o) => o.user.email).join(", "), { companyName: company.name }))
      .catch((err) => console.error(`[approval email] failed for ${company.name}:`, err.message));
  }
}
