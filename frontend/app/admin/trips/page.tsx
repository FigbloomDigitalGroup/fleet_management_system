"use client";

import TripsList from "../../components/TripsList";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminTripsPage() {
  usePageHeader("Trips", "Trip history across your fleet");

  return (
    <div>
      <TripsList basePath="/admin/trips" />
    </div>
  );
}
