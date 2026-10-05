"use client";

import GeofencesManager from "../../components/GeofencesManager";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyGeofencesPage() {
  usePageHeader("Geofences", "Zones your fleet is being monitored against");

  return (
    <div>
      <GeofencesManager canManage={true} />
    </div>
  );
}
