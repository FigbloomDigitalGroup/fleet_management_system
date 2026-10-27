"use client";

import CompanyOpsSettings from "../../components/CompanyOpsSettings";
import { usePageHeader } from "../../components/DashboardShell";
import { useAdminAccess } from "../../lib/adminAccess";

export default function AdminSettingsPage() {
  const { canManageFleet } = useAdminAccess();
  usePageHeader("Settings", "Alerts, tracking hours and data retention for your company");

  return (
    <div className="max-w-4xl">
      {/* Nav hides this page for limited admins, but a direct visit still
          shows the values read-only rather than a form the server rejects. */}
      <CompanyOpsSettings canEdit={canManageFleet} />
    </div>
  );
}
