"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import { usePageHeader } from "../../components/DashboardShell";
import { AgentScanLogRecord } from "../../types/auth";

const statusStyles: Record<string, string> = {
  success: "bg-teal-50 text-teal-600 border-teal-200",
  failed: "bg-red-50 text-red-600 border-red-200",
};

export default function AgentOverviewPage() {
  const [scans, setScans] = useState<AgentScanLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiRequest<AgentScanLogRecord[]>("/api/agent/scans?limit=30");
      setScans(data);
    } catch (err: any) {
      setError(err.message || "Failed to load agent scan history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRunScan() {
    setRunning(true);
    setError(null);
    try {
      await apiRequest<AgentScanLogRecord>("/api/agent/scan-now", { method: "POST" });
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to run agent scan");
    } finally {
      setRunning(false);
    }
  }

  const sevenDaysAgo = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const totalScans = scans.length;
  const anomaliesLast7Days = scans
    .filter((s) => new Date(s.runAt).getTime() >= sevenDaysAgo)
    .reduce((sum, s) => sum + s.anomaliesFound, 0);
  const lastScan = scans[0] ?? null;
  const geminiStatus = lastScan ? (lastScan.status === "success" ? "Working" : "Not working") : "Unknown";

  const statsNode = useMemo(
    () => (
      <div className="grid grid-cols-2 gap-3 h-full">
        <StatCard label="Total scans" value={totalScans} accent="blue" description="Runs recorded" />
        <StatCard label="Anomalies (7d)" value={anomaliesLast7Days} accent="orange" description="Flagged in the last 7 days" />
        <StatCard
          label="Last scan"
          value={lastScan ? new Date(lastScan.runAt).toLocaleTimeString() : "—"}
          accent="green"
          description={lastScan ? new Date(lastScan.runAt).toLocaleDateString() : "No scans yet"}
        />
        <StatCard
          label="Gemini"
          value={geminiStatus}
          accent={geminiStatus === "Working" ? "green" : "orange"}
          description="Based on the most recent scan"
        />
      </div>
    ),
    [totalScans, anomaliesLast7Days, lastScan, geminiStatus]
  );

  usePageHeader("AI Agent", "Operational history for the anomaly-detection agent", statsNode);

  if (loading) return <FullPageLoading label="Loading agent history" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-700">Scan history</h2>
          <p className="text-xs text-teal-600 mt-0.5">Every run of the AI pattern-anomaly agent, scheduled or manual</p>
        </div>
        <button
          onClick={handleRunScan}
          disabled={running}
          className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
        >
          {running ? "Running…" : "Run scan now"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
        {scans.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No scans yet — they run automatically every 15 minutes, or click &quot;Run scan now&quot;.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Run at</th>
                <th className="text-left px-5 py-3 font-medium">Vehicles scanned</th>
                <th className="text-left px-5 py-3 font-medium">Anomalies</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const isExpanded = expandedId === scan._id;
                return (
                  <Fragment key={scan._id}>
                    <tr className="border-t border-gray-100">
                      <td className="px-5 py-3 text-gray-900 font-medium">
                        {new Date(scan.runAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{scan.vehiclesScanned}</td>
                      <td className="px-5 py-3 text-gray-600">{scan.anomaliesFound}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${statusStyles[scan.status]}`}>
                          {scan.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : scan._id)}
                          className="text-xs text-teal-600 hover:underline"
                        >
                          {isExpanded ? "Hide detail" : "View detail"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-gray-100 bg-gray-50">
                        <td colSpan={5} className="px-5 py-4">
                          {scan.errorMessage && (
                            <p className="text-xs text-red-600 mb-3">Error: {scan.errorMessage}</p>
                          )}
                          {scan.details.length === 0 ? (
                            <p className="text-xs text-gray-400">No vehicles had recent activity in this run.</p>
                          ) : (
                            <div className="space-y-2">
                              {scan.details.map((d, i) => (
                                <div key={i} className="flex items-start justify-between gap-3 text-xs">
                                  <div>
                                    <span className="font-bold text-gray-900">{d.plateNumber}</span>
                                    <span className="text-gray-400"> — </span>
                                    <span className="text-gray-600">{d.reason || "no reason given"}</span>
                                  </div>
                                  <span
                                    className={`shrink-0 px-2 py-0.5 rounded-full border font-medium ${
                                      d.anomaly
                                        ? "bg-red-50 text-red-600 border-red-200"
                                        : "bg-gray-100 text-gray-500 border-gray-200"
                                    }`}
                                  >
                                    {d.anomaly ? "anomaly" : "normal"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
