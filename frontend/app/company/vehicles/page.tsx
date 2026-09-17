"use client";

import VehiclesList from "../../components/VehiclesList";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyVehiclesPage() {
  usePageHeader("Vehicles", "Every vehicle registered under your fleet");

  return (
    <div>
      <VehiclesList basePath="/company/vehicles" canAssignDriver={false} />
    </div>
  );
}
