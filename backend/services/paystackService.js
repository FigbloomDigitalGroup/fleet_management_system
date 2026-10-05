// Thin wrapper over Paystack's REST API — raw fetch, no SDK, matching the
// house convention already used for Google Maps (see googleMapsService.js).
// Docs: https://paystack.com/docs/api/transaction/

import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

// Confirms a webhook request genuinely came from Paystack — it's a public
// URL, so this is the only thing stopping anyone from POSTing a fake
// "charge.success" event and granting themselves a free upgrade.
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

// Starts a transaction server-side so the amount can't be tampered with by
// the client — returns an access_code the frontend uses to resume/open the
// Paystack Inline popup, rather than trusting an amount passed from the browser.
export async function initializeTransaction({ email, amount, currency, reference, channels, metadata }) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100), // Paystack amounts are in the subunit (cents)
      currency,
      reference,
      channels,
      metadata,
    }),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || "Failed to initialize Paystack transaction");
  return data.data; // { authorization_url, access_code, reference }
}

// Server-to-server check of a transaction's real status — the only source
// of truth this app trusts for actually granting a plan upgrade (never the
// client's own claim that payment succeeded).
export async function verifyTransaction(reference) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || "Failed to verify Paystack transaction");
  return data.data; // { status, amount, currency, channel, paid_at, reference, metadata, ... }
}
