"use client";

import ReportsView from "../../components/ReportsView";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminReportsPage() {
  usePageHeader("Reports", "Distance, driving time, jobs, costs and safety per vehicle or driver");

  return (
    <div>
      <ReportsView />
    </div>
  );
}
