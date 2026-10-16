"use client";

import GeofencesManager from "../../components/GeofencesManager";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminGeofencesPage() {
  usePageHeader("Geofences", "Zones that trigger alerts when vehicles enter or exit");

  return (
    <div>
      <GeofencesManager canManage={true} />
    </div>
  );
}
