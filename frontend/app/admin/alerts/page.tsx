"use client";

import Link from "next/link";
import AlertsList from "@/app/components/AlertList";
import { usePageHeader } from "@/app/components/DashboardShell";

export default function AdminAlertsPage() {
  usePageHeader("Alerts", "Driving, phone, zone, job and inspection alerts across your fleet");

  return (
    <div>
      <AlertsList />
      <p className="mt-4 text-xs text-gray-500">
        Looking for unusual patterns the AI agent spotted?{" "}
        <Link href="/admin/agent" className="font-medium text-teal-700 hover:underline">
          See AI agent findings
        </Link>
      </p>
    </div>
  );
}
