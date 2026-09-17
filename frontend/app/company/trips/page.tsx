"use client";

import TripsList from "../../components/TripsList";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyTripsPage() {
  usePageHeader("Trips", "Trip history across your fleet");

  return (
    <div>
      <TripsList basePath="/company/trips" />
    </div>
  );
}
