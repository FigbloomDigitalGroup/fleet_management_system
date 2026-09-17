"use client";

import AlertsList from "@/app/components/AlertList";
import { usePageHeader } from "@/app/components/DashboardShell";

export default function AdminAlertsPage() {
  usePageHeader("Alerts", "Speeding, idle, and offline notifications");

  return (
    <div>
      <AlertsList />
    </div>
  );
}
