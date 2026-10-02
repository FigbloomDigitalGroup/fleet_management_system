"use client";

import RoutesManager from "../../components/RoutesManager";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyRoutesPage() {
  usePageHeader("Routes", "Planned paths your fleet is being monitored against");

  return (
    <div>
      <RoutesManager canManage={false} />
    </div>
  );
}
