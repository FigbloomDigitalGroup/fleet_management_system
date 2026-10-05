"use client";

import VehiclesList from "../../components/VehiclesList";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminVehiclesPage() {
  usePageHeader("Vehicles", "Every vehicle registered under your fleet");

  return (
    <div>
      <VehiclesList basePath="/admin/vehicles" canAdd={true} />
    </div>
  );
}
