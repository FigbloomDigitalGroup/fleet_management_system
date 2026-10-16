"use client";

import DriversList from "../../components/DriversList";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminDriversPage() {
  usePageHeader("Drivers", "Add drivers and assign them to vehicles");

  return (
    <div>
      <DriversList canAdd={true} canAssignVehicle={true} />
    </div>
  );
}
