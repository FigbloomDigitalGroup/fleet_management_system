"use client";

import InspectionsList from "../../components/InspectionsList";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyInspectionsPage() {
  usePageHeader("Inspections", "Pre-trip vehicle checks submitted by drivers");

  return (
    <div>
      <InspectionsList />
    </div>
  );
}
