"use client";

import ReportsView from "../../components/ReportsView";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminReportsPage() {
  usePageHeader("Reports", "Distance, fuel, trips, safety, geofences and maintenance across your fleet");

  return (
    <div>
      <ReportsView />
    </div>
  );
}
