// The Figbloom platform's API, as Fleet calls it (FLEET_PLATFORM_CONTRACT.md
// section 2; the same client as Figbloom Schools' _shared/platformClient.ts).
//
// Fleet signs in as its own machine client (Cognito service client "fleet")
// with the client-credentials grant, and may only read and write Fleet's own
// records (/products/fleet/...). Settings:
//   PLATFORM_API_URL      the platform API's address
//   PLATFORM_TOKEN_URL    the Cognito token endpoint (.../oauth2/token)
//   PLATFORM_CLIENT_ID, PLATFORM_CLIENT_SECRET   the fleet service client
//
// The token is kept in memory until a minute before it expires, and dropped
// and fetched again once if the API answers 401.

export const PLATFORM_MODULE = "fleet";
const SCOPE = "platform/tenants.read platform/tenants.write";
const TIMEOUT_MS = 10_000;
const EXPIRY_MARGIN_MS = 60_000;

// A refusal or failure from the platform: status 0 means it was never
// reached (network, timeout).
export class PlatformError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "PlatformError";
    this.status = status;
    this.code = code;
  }
  // Worth trying again later: unreachable, throttled, or the platform's own trouble.
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export function platformConfigFromEnv(env = process.env) {
  const clientId = env.PLATFORM_CLIENT_ID?.trim();
  const clientSecret = env.PLATFORM_CLIENT_SECRET?.trim();
  const tokenUrl = env.PLATFORM_TOKEN_URL?.trim();
  const apiUrl = env.PLATFORM_API_URL?.trim();
  if (!clientId || !clientSecret || !tokenUrl || !apiUrl) return null;
  return { clientId, clientSecret, tokenUrl, apiUrl: apiUrl.replace(/\/+$/, "") };
}

export class PlatformClient {
  constructor(config, { fetch: fetchFn = globalThis.fetch, now = Date.now } = {}) {
    this.config = config;
    this.fetchFn = fetchFn;
    this.now = now;
    this.token = null;
  }

  putOrganization(localId, body) {
    return this.call("PUT", `/products/${PLATFORM_MODULE}/organizations/${encodeURIComponent(localId)}`, body);
  }

  getOrganization(localId) {
    return this.call("GET", `/products/${PLATFORM_MODULE}/organizations/${encodeURIComponent(localId)}`);
  }

  putTenant(localId, body) {
    return this.call("PUT", `/products/${PLATFORM_MODULE}/tenants/${encodeURIComponent(localId)}`, body);
  }

  // null stops decisions (they wait on the platform, undelivered).
  putDecisionWebhook(url) {
    return this.call("PUT", `/products/${PLATFORM_MODULE}/decision-webhook`, { url });
  }

  // Where the platform's relay delivers events to Fleet (hr.employee.left,
  // hr.leave.*): POST /api/platform/events. null stops them (they wait).
  putEventWebhook(url) {
    return this.call("PUT", `/products/${PLATFORM_MODULE}/event-webhook`, { url });
  }

  // POST /events: { type: "fleet.staff.created", id, occurred_at, tenant_local_id, data }.
  // A repeated id is accepted and not delivered again. -> { deliveries }
  postEvent(event) {
    return this.call("POST", "/events", event);
  }

  // POST /handoffs: a one-time sign-in link into another product (HR).
  // -> { url, expires_at }; 409 target_not_enabled | target_not_linked |
  // target_no_handoff_url, 404 for a company the platform doesn't know.
  createHandoff(body) {
    return this.call("POST", "/handoffs", body);
  }

  async accessToken() {
    if (this.token && this.now() < this.token.expiresAt - EXPIRY_MARGIN_MS) return this.token.value;
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const res = await this.send(this.config.tokenUrl, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }).toString(),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not JSON */
    }
    if (!res.ok || typeof data?.access_token !== "string") {
      // never the secret, and nothing of Cognito's answer beyond its error code
      throw new PlatformError(`Could not get a platform token (${res.status}${data?.error ? ` ${data.error}` : ""}).`, res.status || 0, "token_failed");
    }
    const seconds = Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600;
    this.token = { value: data.access_token, expiresAt: this.now() + seconds * 1000 };
    return this.token.value;
  }

  forgetToken() {
    this.token = null;
  }

  async call(method, path, body, retried = false) {
    const token = await this.accessToken();
    const res = await this.send(`${this.config.apiUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 && !retried) {
      // revoked or rotated early: once more with a fresh token
      await res.body?.cancel?.().catch(() => {});
      this.token = null;
      return this.call(method, path, body, true);
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        /* not JSON */
      }
    }
    if (!res.ok) {
      const code = typeof data?.error?.code === "string" ? data.error.code : `http_${res.status}`;
      const message = typeof data?.error?.message === "string" ? data.error.message : `The platform answered ${res.status}.`;
      throw new PlatformError(message, res.status, code);
    }
    return data;
  }

  async send(url, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal, redirect: "error" });
    } catch (err) {
      const why = controller.signal.aborted ? "timed out" : err?.message || String(err);
      throw new PlatformError(`The platform could not be reached (${why}).`, 0, "unreachable");
    } finally {
      clearTimeout(timer);
    }
  }
}

// One client per process, so its token is reused across cron runs; null
// when the PLATFORM_* settings aren't all set.
let shared;
export function sharedPlatformClient() {
  if (shared === undefined) {
    const config = platformConfigFromEnv();
    shared = config ? new PlatformClient(config) : null;
  }
  return shared;
}
