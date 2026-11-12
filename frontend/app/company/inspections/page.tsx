"use client";

import FleetMaintenanceSummary from "../../components/FleetMaintenanceSummary";
import InspectionsList from "../../components/InspectionsList";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyInspectionsPage() {
  usePageHeader("Inspections & maintenance", "Drivers' pre-trip checks, and service reminders across your fleet");

  return (
    <div>
      <InspectionsList />
      <FleetMaintenanceSummary basePath="/company" />
    </div>
  );
}
