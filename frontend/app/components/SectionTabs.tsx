"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Two closely related pages under one menu item (e.g. "Jobs & routes"):
// tabs at the top of each, so both are one tap apart and the menu stays short.
export default function SectionTabs({ tabs }: { tabs: { label: string; href: string; hint?: string }[] }) {
  const pathname = usePathname();
  const current = tabs.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
  return (
    <div className="mb-4">
      <div className="inline-flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5" role="tablist">
        {tabs.map((t) => {
          const active = t === current;
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {current?.hint && <p className="mt-2 text-xs text-gray-500">{current.hint}</p>}
    </div>
  );
}

export function jobsRoutesTabs(base: "/company" | "/admin") {
  return [
    {
      label: "Jobs",
      href: `${base}/jobs`,
      hint: "Jobs are today's deliveries and visits: who goes where, in what order, with live ETAs you can share with customers.",
    },
    {
      label: "Routes",
      href: `${base}/routes`,
      hint: "Routes are planned paths a vehicle should follow; leaving one raises an alert. Zones to stay in or avoid are under Geofences.",
    },
  ];
}
