// Figbloom accounts for the web users Fleet already has (ERP/FLEET_COGNITO_CONTRACT.md
// section 2, "Existing staging users"). Everyone with an active membership
// other than DRIVER, and no Figbloom account linked yet, gets one (made
// without a password) and its sub stored. Someone the account was just made
// for is emailed Fleet's "Set your password" link; someone who already had a
// Figbloom account (another product) signs in with it.
//
// Drivers keep Fleet's own password (the app). Figbloom staff with no fleet
// of their own are left out: their staff-pool accounts are made by hand.
// Running it twice is harmless: linked people are skipped.
import { figbloomAccounts } from "./figbloomAccounts.js";

const ROLE_ORDER = ["COMPANY_OWNER", "ADMIN"];

// -> [{ id, email, fullName, role, companyName }], one per person
export async function peopleToBackfill(db) {
  const memberships = await db.membership.findMany({
    where: { status: "active", role: { not: "DRIVER" }, user: { identitySub: null } },
    select: {
      role: true,
      user: { select: { id: true, email: true, fullName: true } },
      company: { select: { name: true } },
    },
  });
  const byUser = new Map();
  for (const m of memberships) {
    const rank = (role) => (ROLE_ORDER.includes(role) ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length);
    const seen = byUser.get(m.user.id);
    // the email names their most senior fleet
    if (!seen || rank(m.role) < rank(seen.role)) byUser.set(m.user.id, { ...m.user, role: m.role, companyName: m.company.name });
  }
  return [...byUser.values()].sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * apply: false only lists. -> { total, linked, emailed, existing, failed }.
 * sendWelcome(user, companyName) emails the "Set your password" link.
 */
export async function backfillFigbloomAccounts(db, { apply = false, sendWelcome, log = console.log } = {}) {
  const people = await peopleToBackfill(db);
  const out = { total: people.length, linked: 0, emailed: 0, existing: 0, failed: 0 };
  for (const person of people) {
    if (!apply) {
      log(`would link ${person.email} (${person.role}, ${person.companyName})`);
      continue;
    }
    try {
      const account = await figbloomAccounts.ensure({ email: person.email, name: person.fullName });
      await db.user.update({ where: { id: person.id }, data: { identitySub: account.sub } });
      out.linked++;
      if (account.created) {
        await sendWelcome(person, person.companyName);
        out.emailed++;
        log(`linked ${person.email}: new Figbloom account, "Set your password" emailed`);
      } else {
        out.existing++;
        log(`linked ${person.email}: already had a Figbloom account`);
      }
    } catch (err) {
      out.failed++;
      log(`FAILED ${person.email}: ${err.message}`);
    }
  }
  return out;
}
