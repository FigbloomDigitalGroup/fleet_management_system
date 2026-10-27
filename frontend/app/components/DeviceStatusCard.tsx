"use client";

import { ReactNode, useEffect, useState } from "react";
import { FiBattery, FiBatteryCharging, FiMapPin, FiRadio, FiSmartphone, FiAlertTriangle } from "react-icons/fi";
import { apiRequest } from "../lib/api";
import { timeAgo } from "../lib/dateKeys";
import { LiveVehicleRecord } from "../types/auth";

function Item({ icon, label, value, tone = "default" }: { icon: ReactNode; label: string; value: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-teal-600" : tone === "warn" ? "text-orange-600" : tone === "bad" ? "text-red-600" : "text-gray-900";
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 rounded bg-teal-50 p-1.5 text-teal-600">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-sm font-medium ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// The driver phone's last reported health — battery, GPS, whether the app
// is still sharing — so a dispatcher can tell "parked" from "phone died".
export default function DeviceStatusCard({ vehicleId }: { vehicleId: string }) {
  const [live, setLive] = useState<LiveVehicleRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  // When we last polled — "how long silent" is measured against this
  // rather than reading the clock during render.
  const [checkedAt, setCheckedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiRequest<LiveVehicleRecord[]>("/api/tracking/live");
        if (!cancelled) {
          setLive(data.find((v) => v.vehicleId === vehicleId) ?? null);
          setCheckedAt(Date.now());
        }
      } catch {
        // Keep whatever was showing.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [vehicleId]);

  const device = live?.device ?? null;

  if (!loaded) return <div className="skeleton-shimmer h-20 rounded" />;
  if (!device) {
    return <p className="text-sm text-gray-400">The driver app hasn&apos;t reported phone status for this vehicle yet.</p>;
  }

  const battery = device.batteryLevel != null ? Math.round(device.batteryLevel * 100) : null;
  const silentMinutes = device.lastSeenAt ? (checkedAt - new Date(device.lastSeenAt).getTime()) / 60000 : null;

  return (
    <div>
      {live?.lastLocation?.isMocked && (
        <p className="mb-3 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          <FiAlertTriangle /> The latest location came from a fake-GPS app — treat it with suspicion.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Item
          icon={device.isCharging ? <FiBatteryCharging size={14} /> : <FiBattery size={14} />}
          label="Battery"
          value={battery == null ? "Unknown" : `${battery}%${device.isCharging ? " · charging" : ""}`}
          tone={battery == null ? "default" : battery <= 15 ? "bad" : battery <= 30 ? "warn" : "good"}
        />
        <Item
          icon={<FiMapPin size={14} />}
          label="Location services"
          value={
            device.locationEnabled == null
              ? "Unknown"
              : device.locationEnabled
                ? `On${device.permission ? ` (${device.permission})` : ""}`
                : "Off"
          }
          tone={device.locationEnabled === false || device.permission === "denied" ? "bad" : device.locationEnabled ? "good" : "default"}
        />
        <Item
          icon={<FiRadio size={14} />}
          label="Sharing location"
          value={device.isSharing == null ? "Unknown" : device.isSharing ? "On" : "Off"}
          tone={device.isSharing === false ? "warn" : device.isSharing ? "good" : "default"}
        />
        <Item
          icon={<FiSmartphone size={14} />}
          label="Last seen"
          value={device.lastSeenAt ? timeAgo(device.lastSeenAt) : "Never"}
          tone={silentMinutes == null ? "default" : silentMinutes > 30 ? "warn" : "good"}
        />
        <Item icon={<FiSmartphone size={14} />} label="App state" value={device.appState ?? "Unknown"} />
        <Item
          icon={<FiSmartphone size={14} />}
          label="Phone / app"
          value={[device.platform, device.appVersion && `v${device.appVersion}`].filter(Boolean).join(" · ") || "Unknown"}
        />
      </div>
    </div>
  );
}
