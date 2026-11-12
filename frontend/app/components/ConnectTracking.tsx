"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { FiCheck, FiCopy, FiCpu, FiSmartphone } from "react-icons/fi";
import { API_URL, apiRequest } from "../lib/api";
import { SUPPORT_EMAIL } from "../lib/support";

// "Connect tracking" on a vehicle's page: how this vehicle gets onto the
// live map. Two ways: a GPS tracker that posts its location with its own
// secret token (issued here), or the driver's phone running the driver app.

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {});
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-teal-400 hover:text-teal-700"
    >
      {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default function ConnectTracking({
  vehicleId,
  plateNumber,
  deviceId,
  hasTrackerToken,
  driverName,
  lastSeenAt,
  driversHref,
  canManage,
  onDeviceIdSaved,
}: {
  vehicleId: string;
  plateNumber: string;
  deviceId: string | null | undefined;
  hasTrackerToken: boolean;
  driverName: string | null;
  lastSeenAt: string | null;
  driversHref: string;
  canManage: boolean;
  onDeviceIdSaved: () => void;
}) {
  const [method, setMethod] = useState<"tracker" | "phone">("tracker");
  const [token, setToken] = useState<string | null>(null);
  const [tokenExists, setTokenExists] = useState(hasTrackerToken);
  const [issuing, setIssuing] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [deviceInput, setDeviceInput] = useState(deviceId ?? "");
  const [savingDevice, setSavingDevice] = useState(false);

  const pingUrl = `${API_URL}/api/tracking/ping`;

  async function issueToken() {
    setIssuing(true);
    try {
      const { trackerToken } = await apiRequest<{ trackerToken: string }>(`/api/vehicles/${vehicleId}/tracker-token`, {
        method: "POST",
        successMessage: tokenExists ? "New tracker token created. The old one no longer works." : "Tracker token created.",
      });
      setToken(trackerToken);
      setTokenExists(true);
      setConfirmReplace(false);
    } catch {
      // apiRequest has shown why
    } finally {
      setIssuing(false);
    }
  }

  async function saveDeviceId(e: FormEvent) {
    e.preventDefault();
    setSavingDevice(true);
    try {
      await apiRequest(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        body: JSON.stringify({ deviceId: deviceInput.trim() || null }),
        successMessage: "Tracker ID saved.",
      });
      onDeviceIdSaved();
    } catch {
      // shown by apiRequest
    } finally {
      setSavingDevice(false);
    }
  }

  const setupText = token
    ? [
        `Figbloom Fleet tracker setup for ${plateNumber}`,
        `Server URL: ${pingUrl}`,
        "Method: POST, Content-Type: application/json",
        `Header: x-tracker-token: ${token}`,
        'Body: {"latitude": -1.2921, "longitude": 36.8219, "speedKph": 42, "recordedAt": "2026-11-12T08:30:00Z"}',
        'Several points at once: {"pings": [ {...}, {...} ]} (up to 500)',
      ].join("\n")
    : "";

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <section id="connect-tracking" className="scroll-mt-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Connect tracking</h3>
          <p className="mt-0.5 text-xs text-teal-600">How {plateNumber} gets onto the live map</p>
        </div>
        {lastSeenAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
            <span className="h-2 w-2 rounded-full bg-teal-500" /> Reporting · last location {timeAgo(lastSeenAt)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> Not reporting yet
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-1 rounded-lg bg-gray-50 p-1 ring-1 ring-gray-200 sm:max-w-md" role="tablist">
        <button type="button" role="tab" aria-selected={method === "tracker"} onClick={() => setMethod("tracker")} className={tabClass(method === "tracker")}>
          <FiCpu size={15} /> GPS tracker
        </button>
        <button type="button" role="tab" aria-selected={method === "phone"} onClick={() => setMethod("phone")} className={tabClass(method === "phone")}>
          <FiSmartphone size={15} /> Driver&apos;s phone
        </button>
      </div>

      {method === "tracker" ? (
        <div className="mt-4 space-y-4 text-sm text-gray-700">
          <p>
            A GPS tracker in the vehicle sends its position to Figbloom Fleet using a secret token that belongs to this
            vehicle only.
          </p>

          {!canManage ? (
            <p className="text-xs text-gray-500">
              {tokenExists ? "A tracker token has been set up for this vehicle." : "No tracker has been set up yet."} Only the
              owner or a full fleet admin can create tracker tokens.
            </p>
          ) : token ? (
            <div className="rounded-md border border-teal-200 bg-teal-50 p-3">
              <p className="text-xs font-medium text-teal-900">
                Tracker token for {plateNumber}. Copy it now: for security it&apos;s only shown once.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-gray-900 ring-1 ring-teal-200">
                  {token}
                </code>
                <CopyButton text={token} label="Copy token" />
              </div>
            </div>
          ) : tokenExists && !confirmReplace ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
              <span className="flex-1">
                A tracker token is already set up for this vehicle. Lost it? Create a new one: the old token stops working
                straight away.
              </span>
              <button
                type="button"
                onClick={() => setConfirmReplace(true)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:border-teal-400"
              >
                Create a new token
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={issueToken}
                disabled={issuing}
                className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {issuing ? "Creating…" : confirmReplace ? "Yes, replace the token" : "Create tracker token"}
              </button>
              {confirmReplace && (
                <>
                  <span className="text-xs text-red-600">The tracker using the old token will stop reporting until you update it.</span>
                  <button type="button" onClick={() => setConfirmReplace(false)} className="text-xs text-gray-500 hover:underline">
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-gray-600">
            <li>
              In the tracker&apos;s settings (or its &quot;HTTP push&quot; / server forwarding option), set the server address to{" "}
              <code className="break-all rounded bg-gray-100 px-1 font-mono text-[11px] text-gray-900">{pingUrl}</code>{" "}
              <CopyButton text={pingUrl} label="Copy URL" />, sending JSON with POST.
            </li>
            <li>
              Add the header <code className="rounded bg-gray-100 px-1 font-mono text-[11px] text-gray-900">x-tracker-token</code>{" "}
              with this vehicle&apos;s token.
            </li>
            <li>
              Each update sends <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">latitude</code>,{" "}
              <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">longitude</code> and, if it can,{" "}
              <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">speedKph</code> and{" "}
              <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">recordedAt</code> (every 10 to 30 seconds while
              moving is plenty).
            </li>
            <li>The vehicle appears on the live map with its first location, and trips are recorded automatically.</li>
          </ol>
          {token && (
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={setupText} label="Copy all setup details" />
              <span className="text-xs text-gray-500">to send to whoever installs the tracker.</span>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Many trackers only speak their own protocol (for example GT06 or Teltonika) and need a forwarding service in
            between. Not sure about yours? Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Tracker for ${plateNumber}`)}`} className="font-medium text-teal-700 hover:underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            with the tracker&apos;s make and model and we&apos;ll help.
          </p>

          {canManage && (
            <form onSubmit={saveDeviceId} className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
              <div>
                <label htmlFor="tracker-device-id" className="mb-1 block text-xs font-medium text-gray-600">
                  Tracker ID <span className="font-normal text-gray-400">(optional label, e.g. its IMEI)</span>
                </label>
                <input
                  id="tracker-device-id"
                  value={deviceInput}
                  onChange={(e) => setDeviceInput(e.target.value)}
                  placeholder="Not set"
                  className="w-56 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
              <button
                type="submit"
                disabled={savingDevice || deviceInput.trim() === (deviceId ?? "")}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-teal-400 disabled:opacity-50"
              >
                {savingDevice ? "Saving…" : "Save"}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm text-gray-700">
          <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
            <span className="font-semibold">The FIGBLOOM FLEET driver app is coming soon to Google Play.</span> It isn&apos;t
            available to download yet. Until it is, use a GPS tracker, or email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Driver app early access")}`} className="font-medium underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            to ask about early access for your drivers.
          </p>
          <p className="text-xs text-gray-600">Once the app is out, a driver&apos;s phone reports this vehicle like this:</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-gray-600">
            <li>
              {driverName ? (
                <>
                  <span className="font-medium text-gray-900">{driverName}</span> is assigned to {plateNumber}.
                </>
              ) : (
                <>
                  Add the driver and assign them to {plateNumber} on{" "}
                  <Link href={driversHref} className="font-medium text-teal-700 hover:underline">
                    Drivers
                  </Link>
                  . That creates their sign-in email and password.
                </>
              )}
            </li>
            <li>The driver installs the app and signs in with that email and password.</li>
            <li>They allow location &quot;All the time&quot; so it keeps reporting with the screen off.</li>
            <li>While they&apos;re signed in, {plateNumber} shows on the live map.</li>
          </ol>
        </div>
      )}
    </section>
  );
}
