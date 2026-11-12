// One-off: tells the Figbloom platform where to send Fleet's company
// decisions (PUT /products/fleet/decision-webhook), or with --events where
// to send events from Figbloom HR (PUT /products/fleet/event-webhook):
//   node scripts/platformRegisterWebhook.js --events https://fleet-api-staging.figbloom.org/api/platform/events
//   node scripts/platformRegisterWebhook.js --events --stop
//   node scripts/platformRegisterWebhook.js https://fleet-api-staging.figbloom.org/api/platform/decisions
//   node scripts/platformRegisterWebhook.js            uses PLATFORM_WEBHOOK_URL
//   node scripts/platformRegisterWebhook.js --stop     stops decisions (they wait on the platform)
// On the AWS server: docker exec app-app-1 node scripts/platformRegisterWebhook.js <url>
// Needs the PLATFORM_* settings.
import "dotenv/config";
import { sharedPlatformClient } from "../lib/platform/client.js";

function webhookUrl(given, fallback) {
  const candidate = (given || fallback || "").trim();
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function run() {
  const client = sharedPlatformClient();
  if (!client) {
    console.error("Set PLATFORM_API_URL, PLATFORM_TOKEN_URL, PLATFORM_CLIENT_ID and PLATFORM_CLIENT_SECRET first.");
    process.exitCode = 1;
    return;
  }
  const args = process.argv.slice(2);
  const stop = args.includes("--stop");
  const events = args.includes("--events");
  const given = args.find((a) => !a.startsWith("--"));
  const url = stop ? null : webhookUrl(given, events ? process.env.PLATFORM_EVENT_WEBHOOK_URL : process.env.PLATFORM_WEBHOOK_URL);
  const what = events ? "Events" : "Decisions";
  if (!stop && !url) {
    console.error(`Give the https address, e.g. https://fleet-api-staging.figbloom.org/api/platform/${events ? "events" : "decisions"}.`);
    process.exitCode = 1;
    return;
  }
  const answer = events ? await client.putEventWebhook(url) : await client.putDecisionWebhook(url);
  console.log(stop ? `${what} stopped (they wait on the platform).` : `${what} now go to ${url}`, JSON.stringify(answer));
}

run().catch((err) => {
  console.error(`The platform refused: ${err?.code ? `${err.code} (${err.status}) ` : ""}${err?.message || err}`);
  process.exitCode = 1;
});
