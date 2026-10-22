import { ReactNode } from "react";

// Small building blocks for dashboard metrics, used by OpsMetrics.

// One horizontal bar split into colored segments (widths in % of the total).
export function SegmentBar({
  segments,
  thin = false,
}: {
  segments: { value: number; color: string; label: string }[];
  // Hairline variant for tight spots like the stat cards' supporting metrics.
  thin?: boolean;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className={`flex ${thin ? "h-1" : "h-2"} w-full overflow-hidden rounded-full bg-gray-100`}>
      {total > 0 &&
        segments.map((s) =>
          s.value > 0 ? (
            <span key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          ) : null
        )}
    </div>
  );
}

// Tiny status badge — orange to watch, red to act, grey for neutral info.
export function Chip({ children, tone }: { children: ReactNode; tone: "warn" | "bad" | "muted" | "ok" }) {
  const cls = {
    warn: "bg-orange-50 text-orange-600",
    bad: "bg-red-50 text-red-600",
    muted: "bg-gray-100 text-gray-500",
    ok: "bg-teal-50 text-teal-600",
  }[tone];
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

// "25 min" / "3 h" / "2 d" since an ISO timestamp.
export function ageLabel(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} d`;
}
