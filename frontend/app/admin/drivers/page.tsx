"use client";

import DriversList from "../../components/DriversList";
import { usePageHeader } from "../../components/DashboardShell";
import { useAdminAccess } from "../../lib/adminAccess";

export default function AdminDriversPage() {
  const { canManageFleet } = useAdminAccess();
  usePageHeader("Drivers", "Add drivers and assign them to vehicles");

  return (
    <div>
      <DriversList canAdd={canManageFleet} canAssignVehicle={canManageFleet} />
    </div>
  );
}
