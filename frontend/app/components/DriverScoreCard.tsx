"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { DriverScore } from "../types/auth";
import Skeleton from "./Skeleton";

// Colour by grade band: Excellent (≥90) and Good (≥75) are both on the
// teal side, Fair orange, Needs coaching red.
export function scoreColor(score: number | null): string {
  if (score == null) return "#9ca3af";
  if (score >= 90) return "#059669";
  if (score >= 75) return "#0d9488";
  if (score >= 60) return "#f97316";
  return "#dc2626";
}

export function scoreBadgeClass(score: number | null): string {
  if (score == null) return "bg-gray-100 text-gray-500 border-gray-200";
  if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 75) return "bg-teal-50 text-teal-600 border-teal-200";
  if (score >= 60) return "bg-orange-50 text-orange-600 border-orange-200";
  return "bg-red-50 text-red-600 border-red-200";
}

export function ScoreRing({ score, size = 140 }: { score: number | null; size?: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  const offset = circumference - (value / 100) * circumference;
  const color = scoreColor(score);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={score == null ? "No score yet" : `Score ${score}`}>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      {score != null && (
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      )}
      <text x="50" y={score == null ? 55 : 57} textAnchor="middle" fontSize={score == null ? 14 : 24} fontWeight="700" fill="#172554">
        {score == null ? "—" : Math.round(score)}
      </text>
    </svg>
  );
}

const EVENT_LABELS: { key: keyof DriverScore["events"]; label: string }[] = [
  { key: "speeding", label: "Speeding" },
  { key: "harsh_braking", label: "Harsh braking" },
  { key: "harsh_acceleration", label: "Harsh acceleration" },
  { key: "harsh_cornering", label: "Harsh cornering" },
  { key: "phone_use", label: "Phone use" },
];

const PERIODS = [7, 30, 90];

// Safety score section on the driver detail page (both portals).
export default function DriverScoreCard({ driverId }: { driverId: string }) {
  const [days, setDays] = useState(30);
  const [score, setScore] = useState<DriverScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<DriverScore>(`/api/users/drivers/${driverId}/score?days=${days}`)
      .then((data) => {
        if (!cancelled) {
          setScore(data);
          setError(null);
        }
      })
      .catch((err) => !cancelled && setError(err.message || "Failed to load score"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [driverId, days]);

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Safety score</h3>
          <p className="mt-0.5 text-xs text-teal-600">
            Based on speeding, harsh driving and phone use per 100 km driven
          </p>
        </div>
        <div className="flex rounded border border-gray-200 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={`px-2.5 py-1 ${days === p ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {p} days
            </button>
          ))}
        </div>
      </div>

      {loading && !score && <Skeleton rows={3} rowClassName="h-10" className="mt-4" />}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {score && !error && (
        <div className={`mt-4 flex flex-wrap items-center gap-6 ${loading ? "opacity-60" : ""}`}>
          <div className="flex flex-col items-center">
            <ScoreRing score={score.score} />
            {score.score == null ? (
              <p className="max-w-[160px] text-center text-xs text-gray-500">
                Not enough driving yet (needs {score.minDistanceKm ?? 10} km)
              </p>
            ) : (
              <p className="text-sm font-bold" style={{ color: scoreColor(score.score) }}>
                {score.grade}
              </p>
            )}
          </div>

          <div className="min-w-[220px] flex-1">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Distance driven</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{score.distanceKm.toLocaleString()} km</dd>
              </div>
              <div>
                <dt className="text-gray-500">Trips</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{score.trips}</dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-1.5">
              {EVENT_LABELS.map(({ key, label }) => {
                const count = score.events?.[key] ?? 0;
                return (
                  <li key={key} className="flex items-center justify-between border-b border-gray-100 pb-1.5 text-sm last:border-b-0">
                    <span className="text-gray-600">{label}</span>
                    <span className={`font-medium ${count > 0 ? "text-orange-600" : "text-gray-400"}`}>{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
