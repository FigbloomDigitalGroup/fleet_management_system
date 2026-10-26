"use client";

import GeofencesManager from "../../components/GeofencesManager";
import { usePageHeader } from "../../components/DashboardShell";
import { useAdminAccess } from "../../lib/adminAccess";

export default function AdminGeofencesPage() {
  const { canManageFleet } = useAdminAccess();
  usePageHeader("Geofences", "Zones that trigger alerts when vehicles enter or exit");

  return (
    <div>
      <GeofencesManager canManage={canManageFleet} />
    </div>
  );
}
