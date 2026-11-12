"use client";

import VehiclesList from "../../components/VehiclesList";
import { usePageHeader } from "../../components/DashboardShell";
import { useAdminAccess } from "../../lib/adminAccess";

export default function CompanyVehiclesPage() {
  const { canManageFleet } = useAdminAccess();
  usePageHeader("Vehicles", "Add the vehicles in your fleet and assign their drivers");

  return (
    <div>
      <VehiclesList
        basePath="/company/vehicles"
        canAdd={canManageFleet}
        canAssignDriver={canManageFleet}
        canDelete={canManageFleet}
      />
    </div>
  );
}
