"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCpu } from "react-icons/fi";
import { apiRequest } from "../lib/api";
import { usePageHeader } from "./DashboardShell";
import StatCard from "./StatCard";
import FullPageLoading from "./FullPageLoading";
import { AgentSummary } from "../types/auth";

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Company-scoped view of the AI anomaly agent — proves the agent is actually
// running (presence) and shows, in plain stats and text, what it has found
// for this fleet specifically. Shared by both the admin and company pages.
export default function AgentSummaryPanel() {
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<AgentSummary>("/api/agent/summary")
      .then(setSummary)
      .catch((err) => setError(err.message || "Failed to load agent status"))
      .finally(() => setLoading(false));
  }, []);

  const statsNode = useMemo(() => {
    if (!summary) return undefined;
    return (
      <div className="grid grid-cols-1 gap-3 h-full">
        <StatCard
          label="Scans covering your fleet"
          value={summary.scansCoveringFleet}
          accent="blue"
          description="Runs that included at least one of your vehicles"
        />
        <StatCard
          label="Anomalies found"
          value={summary.anomaliesFound}
          accent={summary.anomaliesFound > 0 ? "orange" : "green"}
          description={`${summary.vehicleChecksLogged} vehicle check${summary.vehicleChecksLogged === 1 ? "" : "s"} logged in total`}
        />
      </div>
    );
  }, [summary]);

  usePageHeader("AI Agent", "How the anomaly-detection agent is watching your fleet", statsNode);

  if (loading) return <FullPageLoading label="Loading agent status" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!summary) return null;

  const isActive = summary.lastScanStatus === "success";
  const hasEverRun = summary.lastScanAt !== null;

  return (
    <div>
      {/* Presence */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 mb-4 flex items-center gap-4">
        <div className="relative shrink-0">
          {isActive && <span className="absolute inset-0 rounded-full bg-teal-500 opacity-75 animate-ping" />}
          <span
            className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
              isActive ? "bg-teal-500" : hasEverRun ? "bg-red-500" : "bg-gray-300"
            }`}
          >
            <FiCpu size={18} color="white" />
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {!hasEverRun
              ? "AI Agent — not run yet"
              : isActive
                ? "AI Agent — active"
                : "AI Agent — last run failed"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {hasEverRun
              ? `Last check-in ${timeAgo(summary.lastScanAt!)} · scans automatically every 15 minutes`
              : "It runs automatically every 15 minutes and will check in here once it does."}
          </p>
        </div>
      </div>

      {/* Recent findings */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
        <p className="text-xs font-medium text-gray-500 p-4 pb-0">Recent findings for your fleet</p>
        {summary.recentFindings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No findings yet — the agent only reports once one of your vehicles has recent GPS activity.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 mt-2">
            {summary.recentFindings.map((f, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{f.plateNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.reason || "No reason given"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(f.runAt)}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-1 rounded-full border font-medium ${
                    f.anomaly
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}
                >
                  {f.anomaly ? "anomaly" : "normal"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
