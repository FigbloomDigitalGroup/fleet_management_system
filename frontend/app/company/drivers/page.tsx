"use client";

import DriversList from "../../components/DriversList";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyDriversPage() {
  usePageHeader("Drivers", "Drivers registered under your fleet and their vehicles");

  return (
    <div>
      <DriversList canAdd={false} canAssignVehicle={false} />
    </div>
  );
}
