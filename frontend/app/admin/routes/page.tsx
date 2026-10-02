"use client";

import RoutesManager from "../../components/RoutesManager";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminRoutesPage() {
  usePageHeader("Routes", "Planned paths vehicles are expected to follow — deviating triggers an alert");

  return (
    <div>
      <RoutesManager canManage={true} />
    </div>
  );
}
