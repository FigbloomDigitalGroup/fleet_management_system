// One-off, after HR_INTEGRATION_ENABLED is switched on: queues every active
// person (owner, team, drivers) of one company, or of all companies, to be
// sent to Figbloom HR as fleet.staff.created (lib/platform/staffEvents.js).
// The every-minute sync sends them; one already sent goes as "updated", so
// running it twice is harmless. A dry run unless --apply:
//   node scripts/hrStaffBackfill.js <companyId>            lists who would be queued
//   node scripts/hrStaffBackfill.js <companyId> --apply    queues them
//   node scripts/hrStaffBackfill.js --all --apply          every company
// On the AWS server: docker exec app-app-1 node scripts/hrStaffBackfill.js <companyId> --apply
import "dotenv/config";
import prisma from "../lib/prisma.js";
import { hrIntegrationEnabled } from "../lib/platform/settings.js";
import { companyPeople, enqueueStaffSync } from "../lib/platform/staffEvents.js";

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const all = args.includes("--all");
  const companyId = args.find((a) => !a.startsWith("--"));
  if (!all && !companyId) {
    console.error("Give a company id, or --all.");
    process.exitCode = 1;
    return;
  }
  if (apply && !hrIntegrationEnabled()) {
    console.error("HR_INTEGRATION_ENABLED is off: nothing would be sent. Switch it on first.");
    process.exitCode = 1;
    return;
  }
  const companies = all
    ? await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } })
    : await prisma.company.findMany({ where: { id: companyId }, select: { id: true, name: true } });
  if (companies.length === 0) {
    console.error(`No company ${companyId}.`);
    process.exitCode = 1;
    return;
  }
  let total = 0;
  for (const company of companies) {
    const people = await companyPeople(prisma, company.id);
    for (const person of people) {
      if (apply) await enqueueStaffSync(prisma, person.id, company.id);
      total++;
    }
    console.log(`${company.name} (${company.id}): ${people.length} person(s)`);
  }
  console.log(apply ? `Queued ${total} person(s); the sync sends them within a minute.` : `Dry run: ${total} person(s) would be queued. Run again with --apply.`);
}

run()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
