"use client";

import RoutesManager from "../../components/RoutesManager";
import { usePageHeader } from "../../components/DashboardShell";
import { useAdminAccess } from "../../lib/adminAccess";

export default function AdminRoutesPage() {
  const { canDispatch } = useAdminAccess();
  usePageHeader("Routes", "Planned paths vehicles are expected to follow — deviating triggers an alert");

  return (
    <div>
      <RoutesManager canManage={canDispatch} />
    </div>
  );
}
