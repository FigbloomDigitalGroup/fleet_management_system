"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { IconType } from "react-icons";
import { SegmentBar, Chip, ageLabel } from "./MetricBits";
import { FaClipboardCheck, FaClipboardList, FaComments, FaMobileAlt, FaShieldAlt, FaTools } from "react-icons/fa";

interface OpsSummary {
  jobsToday: { total: number; completed: number; inProgress: number; pending: number; failed: number; late: number };
  safety: { avgScore: number | null; lastWeekScore: number | null; scoredDrivers: number; totalDrivers: number; incidents30d: number };
  inspectionsToday: { total: number; failed: number; inspectedVehicles: number; expectedVehicles: number };
  maintenance: { overdue: number; dueSoon: number };
  phones: { reporting: number; sharing: number; lowBattery: number; offline: number; fakeGpsToday: number };
  unreadMessages: number;
  oldestUnreadAt: string | null;
}

type Tone = "ok" | "warn" | "bad";

const REFRESH_MS = 30000;

// Colors for each health state — teal when fine, orange to watch, red to act.
const toneText: Record<Tone, string> = { ok: "text-gray-900", warn: "text-orange-600", bad: "text-red-600" };
const toneHex: Record<Tone, string> = { ok: "#0d9488", warn: "#f97316", bad: "#dc2626" };

// Hour of day in Nairobi, where every company operates — used to only flag
// missing pre-trip inspections once the morning is under way.
function nairobiHour() {
  return Number(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false }));
}

function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

// Half-circle gauge for a 0–100 score: faint red/orange/teal zones behind a
// filled arc in the score's own tone.
function ScoreGauge({ score, tone }: { score: number | null; tone: Tone }) {
  const r = 34;
  const arc = (from: number, to: number) => {
    const a = (v: number) => Math.PI * (1 - v / 100);
    const [x1, y1] = [40 + r * Math.cos(a(from)), 40 - r * Math.sin(a(from))];
    const [x2, y2] = [40 + r * Math.cos(a(to)), 40 - r * Math.sin(a(to))];
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  return (
    <svg width="80" height="46" viewBox="0 0 80 46" aria-hidden="true" className="shrink-0">
      <path d={arc(0, 49.5)} stroke="#fecaca" strokeWidth="8" fill="none" />
      <path d={arc(50.5, 69.5)} stroke="#fed7aa" strokeWidth="8" fill="none" />
      <path d={arc(70.5, 100)} stroke="#ccfbf1" strokeWidth="8" fill="none" />
      {score !== null && score > 0 && (
        <path d={arc(0, Math.min(score, 99.9))} stroke={toneHex[tone]} strokeWidth="8" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

// Small coverage ring with the percentage inside.
function MiniRing({ percent, tone }: { percent: number; tone: Tone }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true" className="shrink-0">
      <circle cx="23" cy="23" r={r} fill="none" stroke="#f1f3f5" strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke={toneHex[tone]}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (Math.min(percent, 100) / 100) * c}
        transform="rotate(-90 23 23)"
      />
      <text className="font-figures" x="23" y="26.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#111827">
        {percent}%
      </text>
    </svg>
  );
}

// "Operations today" block on the overview dashboards — jobs, safety,
// inspections, maintenance, driver phones and messages as divided sections of
// one card, each linking to the page where it can be acted on. Each section
// leads with the figure that says whether things are on track, a small visual
// for it, and turns orange/red when it needs attention. One request
// (/api/companies/me/ops-summary). `columns={3}` lays it out as two rows of
// three to sit inside a dashboard grid cell (the parent owns the spacing);
// the default is one full-width row of six.
export default function OpsMetrics({ basePath, columns = 6 }: { basePath: "/company" | "/admin"; columns?: 3 | 6 }) {
  const [ops, setOps] = useState<OpsSummary | null>(null);

  useEffect(() => {
    function load() {
      apiRequest<OpsSummary>("/api/companies/me/ops-summary")
        .then(setOps)
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const loading = <p className="mt-2 text-[11px] text-gray-400">Loading…</p>;

  // Jobs today — completion % with a done / on the way / waiting / failed bar
  const j = ops?.jobsToday;
  const jobsTone: Tone = j?.failed ? "bad" : j?.late ? "warn" : "ok";
  const jobs = !j ? (
    loading
  ) : j.total === 0 ? (
    <Value value="—" sub="No jobs scheduled for today" />
  ) : (
    <>
      <Value value={`${pct(j.completed, j.total)}%`} tone={jobsTone} sub={`${j.completed} / ${j.total} jobs done`} />
      <div className="mt-2.5">
        <SegmentBar
          segments={[
            { label: "Done", value: j.completed, color: "#0d9488" },
            { label: "On the way", value: j.inProgress, color: "#5eead4" },
            { label: "Waiting", value: j.pending, color: "#d1d5db" },
            { label: "Failed", value: j.failed, color: "#ef4444" },
          ]}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
        {j.inProgress} on the way
        {j.failed > 0 && <Chip tone="bad">{j.failed} failed</Chip>}
        {j.late > 0 && <Chip tone="warn">{j.late} late</Chip>}
      </div>
    </>
  );

  // Fleet safety — score out of 100 on a zoned gauge, with the weekly trend
  const s = ops?.safety;
  const safetyTone: Tone = s?.avgScore == null ? "ok" : s.avgScore < 50 ? "bad" : s.avgScore < 70 ? "warn" : "ok";
  const trend = s?.avgScore != null && s.lastWeekScore != null ? s.avgScore - s.lastWeekScore : null;
  const safety = !s ? (
    loading
  ) : s.avgScore === null ? (
    <Value value="—" sub="Drivers need 10 km of driving for a score" />
  ) : (
    <>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={`font-figures text-xl font-bold leading-none ${toneText[safetyTone]}`}>
          {s.avgScore}
          <span className="text-xs font-medium text-gray-400"> / 100</span>
        </p>
        <ScoreGauge score={s.avgScore} tone={safetyTone} />
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500">
        {trend !== null && (
          <span className={`font-semibold ${trend > 0 ? "text-teal-600" : trend < 0 ? "text-red-600" : "text-gray-500"}`}>
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "■"} {trend > 0 ? "+" : ""}
            {trend} vs last week ·{" "}
          </span>
        )}
        {s.scoredDrivers}/{s.totalDrivers} drivers · {s.incidents30d} incidents, 30d
      </p>
    </>
  );

  // Inspections — vehicles checked out of those that should be, today
  const ins = ops?.inspectionsToday;
  const coverage = ins ? pct(ins.inspectedVehicles, ins.expectedVehicles) : 0;
  const inspTone: Tone = ins?.failed
    ? "bad"
    : ins && ins.expectedVehicles > 0 && coverage < 100 && nairobiHour() >= 10
      ? "warn"
      : "ok";
  const inspections = !ins ? (
    loading
  ) : ins.expectedVehicles === 0 ? (
    <Value value={ins.total} sub="No vehicles with a driver to inspect" />
  ) : (
    <>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div>
          <p className={`font-figures text-xl font-bold leading-none ${toneText[inspTone]}`}>
            {ins.inspectedVehicles}
            <span className="text-xs font-medium text-gray-400"> of {ins.expectedVehicles}</span>
          </p>
          <p className="mt-1 text-[11px] text-gray-500">vehicles checked</p>
        </div>
        <MiniRing percent={coverage} tone={inspTone} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
        {ins.failed > 0 ? (
          <Chip tone="bad">{ins.failed} found a problem</Chip>
        ) : coverage < 100 ? (
          `${ins.expectedVehicles - ins.inspectedVehicles} still to check`
        ) : (
          "Every vehicle checked"
        )}
      </div>
    </>
  );

  // Maintenance — overdue (act now) beside due this week (plan for it)
  const m = ops?.maintenance;
  const maintenance = !m ? (
    loading
  ) : (
    <>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className={`font-figures text-xl font-bold leading-none ${m.overdue ? "text-red-600" : "text-gray-900"}`}>{m.overdue}</p>
          <p className="mt-1 text-[11px] text-gray-500">Overdue</p>
        </div>
        <div className="border-l border-gray-100 pl-3">
          <p className={`font-figures text-xl font-bold leading-none ${m.dueSoon ? "text-orange-600" : "text-gray-900"}`}>{m.dueSoon}</p>
          <p className="mt-1 text-[11px] text-gray-500">Due this week</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        {m.overdue ? "Services past their date or mileage" : m.dueSoon ? "Nothing overdue — plan these in" : "All services up to date"}
      </p>
    </>
  );

  // Phones sharing — share of reporting phones sending location, with issues
  const p = ops?.phones;
  const sharingPct = p ? pct(p.sharing, p.reporting) : 0;
  const phonesTone: Tone = p?.fakeGpsToday ? "bad" : p && p.reporting > 0 && sharingPct < 90 ? "warn" : "ok";
  const phones = !p ? (
    loading
  ) : p.reporting === 0 ? (
    <Value value="—" sub="No driver phones reporting yet" />
  ) : (
    <>
      <Value value={`${sharingPct}%`} tone={phonesTone} sub={`${p.sharing} / ${p.reporting} phones sharing`} />
      <div className="mt-2.5">
        <SegmentBar
          segments={[
            { label: "Sharing", value: p.sharing, color: "#0d9488" },
            { label: "Not sharing", value: p.reporting - p.sharing, color: "#e5e7eb" },
          ]}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
        {p.offline > 0 && <Chip tone="warn">{p.offline} gone silent</Chip>}
        {p.lowBattery > 0 && <Chip tone="warn">{p.lowBattery} low battery</Chip>}
        {p.fakeGpsToday > 0 && <Chip tone="bad">{p.fakeGpsToday} fake GPS</Chip>}
        {!p.offline && !p.lowBattery && !p.fakeGpsToday && "All phones healthy"}
      </div>
    </>
  );

  // Unread messages — how many, and how long the oldest has been waiting
  const waitMin = ops?.oldestUnreadAt ? Math.floor((Date.now() - new Date(ops.oldestUnreadAt).getTime()) / 60000) : null;
  const msgTone: Tone = waitMin === null ? "ok" : waitMin > 60 ? "bad" : waitMin > 15 ? "warn" : "ok";
  const waitLabel = ops?.oldestUnreadAt ? ageLabel(ops.oldestUnreadAt) : "";
  const messages = !ops ? (
    loading
  ) : ops.unreadMessages === 0 ? (
    <Value value={0} sub="All caught up" />
  ) : (
    <>
      <Value value={ops.unreadMessages} tone={msgTone} sub="From drivers, awaiting a reply" />
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
        Oldest waiting
        <Chip tone={msgTone === "ok" ? "muted" : msgTone}>{waitLabel}</Chip>
      </div>
    </>
  );

  const cards: { href: string; label: string; icon: IconType; body: ReactNode }[] = [
    { href: `${basePath}/jobs`, label: "Jobs today", icon: FaClipboardList, body: jobs },
    { href: `${basePath}/drivers`, label: "Fleet safety score", icon: FaShieldAlt, body: safety },
    { href: `${basePath}/inspections`, label: "Inspections today", icon: FaClipboardCheck, body: inspections },
    { href: `${basePath}/vehicles`, label: "Maintenance due", icon: FaTools, body: maintenance },
    { href: `${basePath}/live-map`, label: "Phones sharing", icon: FaMobileAlt, body: phones },
    { href: `${basePath}/messages`, label: "Unread messages", icon: FaComments, body: messages },
  ];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 ${
        columns === 3 ? "h-full" : "mb-4"
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <p className="text-[15px] font-semibold text-gray-900">Operations today</p>
        <p className="text-[11px] text-gray-400">Updates every 30 seconds</p>
      </div>
      {/* gap-px over a grey background draws the dividers between sections at
          every breakpoint, however many columns the row wraps into */}
      <div
        className={`grid flex-1 grid-cols-2 gap-px bg-gray-100 md:grid-cols-3 ${columns === 6 ? "xl:grid-cols-6" : ""}`}
      >
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="group bg-white px-5 py-4 transition-colors hover:bg-teal-50/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                  <Icon className="text-teal-600" size={12} />
                </span>
                {c.label}
              </div>
              {c.body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Headline figure with a one-line caption under it.
function Value({ value, sub, tone = "ok" }: { value: string | number; sub: string; tone?: Tone }) {
  return (
    <>
      <p className={`font-figures mt-2 text-xl font-bold leading-none ${toneText[tone]}`}>{value}</p>
      <p className="mt-1 text-[11px] text-gray-500">{sub}</p>
    </>
  );
}
