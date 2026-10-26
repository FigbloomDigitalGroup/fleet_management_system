"use client";

import AlertsList from "@/app/components/AlertList";
import { usePageHeader } from "@/app/components/DashboardShell";

export default function CompanyAlertsPage() {
  usePageHeader("Alerts", "Driving, phone, zone, job and inspection alerts across your fleet");

  return (
    <div>
      <AlertsList />
    </div>
  );
}
