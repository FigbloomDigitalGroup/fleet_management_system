"use client";

import Link from "next/link";

// Concentric broken-ring circles, spinning slowly — click takes you to the live map.
const RINGS = [
  { r: 54, dasharray: "10 6", color: "#22d3ee", opacity: 0.35, width: 2 },
  { r: 47, dasharray: "4 5", color: "#2dd4bf", opacity: 0.45, width: 2 },
  { r: 40, dasharray: "14 4", color: "#22d3ee", opacity: 0.55, width: 2 },
  { r: 33, dasharray: "3 4", color: "#2dd4bf", opacity: 0.65, width: 2 },
  { r: 26, dasharray: "9 5", color: "#2dd4bf", opacity: 0.8, width: 2.5 },
  { r: 19, dasharray: "2 4", color: "#22d3ee", opacity: 0.9, width: 2.5 },
];

export default function LiveMapWidget({ href = "/company/live-map" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Go to live map"
      className="group fixed bottom-6 right-6 z-50 flex h-28 w-28 items-center justify-center rounded-full outline-none"
    >
      <div
        className="absolute inset-0 rounded-full backdrop-blur-sm ring-1 ring-cyan-300/40 transition-transform duration-300 group-hover:scale-110"
        style={{
          background: "radial-gradient(circle, rgba(45,212,191,0.18) 0%, rgba(34,211,238,0.10) 60%, transparent 80%)",
          boxShadow: "0 0 24px rgba(45,212,191,0.35)",
        }}
      />

      <svg viewBox="0 0 120 120" className="spin-slow relative h-full w-full">
        {RINGS.map((ring, i) => (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={ring.r}
            fill="none"
            stroke={ring.color}
            strokeOpacity={ring.opacity}
            strokeWidth={ring.width}
            strokeDasharray={ring.dasharray}
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-bold uppercase tracking-wide text-teal-800 drop-shadow-sm">Live</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-teal-800 drop-shadow-sm">Map</span>
      </div>
    </Link>
  );
}
