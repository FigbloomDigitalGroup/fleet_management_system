"use client";

import VehiclesList from "../../components/VehiclesList";
import { usePageHeader } from "../../components/DashboardShell";
import { useAdminAccess } from "../../lib/adminAccess";

export default function AdminVehiclesPage() {
  const { canManageFleet } = useAdminAccess();
  usePageHeader("Vehicles", "Every vehicle registered under your fleet");

  return (
    <div>
      <VehiclesList
        basePath="/admin/vehicles"
        canAdd={canManageFleet}
        canAssignDriver={canManageFleet}
        canDelete={canManageFleet}
      />
    </div>
  );
}
