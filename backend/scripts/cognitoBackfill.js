// One-off, before COGNITO_SIGN_IN is switched on: gives Fleet's existing web
// users (owners, admins, team) their Figbloom accounts (lib/cognitoBackfill.js).
// A dry run unless --apply:
//   node scripts/cognitoBackfill.js            lists who would get one
//   node scripts/cognitoBackfill.js --apply    creates them, emails "Set your password"
// On the AWS server: docker exec app-app-1 node scripts/cognitoBackfill.js --apply
// Needs the PLATFORM_* settings (the fleet service client).
import "dotenv/config";
import prisma from "../lib/prisma.js";
import { backfillFigbloomAccounts } from "../lib/cognitoBackfill.js";
import { sendWelcome } from "../controllers/authController.js";
import { sharedPlatformClient } from "../lib/platform/client.js";

async function run() {
  const apply = process.argv.includes("--apply");
  if (apply && !sharedPlatformClient()) {
    console.error("The PLATFORM_* settings are missing: Figbloom accounts can't be made. Set them first.");
    process.exitCode = 1;
    return;
  }
  const r = await backfillFigbloomAccounts(prisma, { apply, sendWelcome });
  if (!apply) {
    console.log(`Dry run: ${r.total} person(s) would get a Figbloom account. Run again with --apply.`);
    return;
  }
  console.log(`Linked ${r.linked} of ${r.total}: ${r.emailed} emailed to set a password, ${r.existing} already had an account, ${r.failed} failed.`);
  if (r.failed) process.exitCode = 1;
}

run()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
