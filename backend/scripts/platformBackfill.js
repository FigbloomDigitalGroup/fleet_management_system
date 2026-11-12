// One-off: registers every existing company with the Figbloom platform, with
// its current status (lib/platform/backfill.js). A dry run unless --apply:
//   node scripts/platformBackfill.js            lists what it would send
//   node scripts/platformBackfill.js --apply    sends it
// On the AWS server: docker exec app-app-1 node scripts/platformBackfill.js [--apply]
// Needs DATABASE_URL and, with --apply, the PLATFORM_* settings.
import "dotenv/config";
import prisma from "../lib/prisma.js";
import { sharedPlatformClient } from "../lib/platform/client.js";
import { backfillCompanies } from "../lib/platform/backfill.js";

async function run() {
  const apply = process.argv.includes("--apply");
  const client = sharedPlatformClient();
  if (apply && !client) {
    console.error("Set PLATFORM_API_URL, PLATFORM_TOKEN_URL, PLATFORM_CLIENT_ID and PLATFORM_CLIENT_SECRET first.");
    process.exitCode = 1;
    return;
  }
  const report = await backfillCompanies(prisma, client, { dryRun: !apply });
  console.log(JSON.stringify(report, null, 2));
  console.log(
    apply
      ? `Sent ${report.companies.length - report.errors.length} of ${report.companies.length} company(ies); ${report.errors.length} error(s).`
      : `Dry run: ${report.companies.length} company(ies) would be registered. Run again with --apply to send them.`
  );
  if (report.errors.length) process.exitCode = 1;
}

run()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
