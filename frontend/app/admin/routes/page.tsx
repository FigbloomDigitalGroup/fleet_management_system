"use client";

import SectionTabs, { jobsRoutesTabs } from "../../components/SectionTabs";
import RoutesManager from "../../components/RoutesManager";
import { usePageHeader } from "../../components/DashboardShell";
import { useAdminAccess } from "../../lib/adminAccess";

export default function AdminRoutesPage() {
  const { canDispatch } = useAdminAccess();
  usePageHeader("Jobs & routes", "Plan the day's deliveries and visits, and the paths vehicles should follow");

  return (
    <div>
      <SectionTabs tabs={jobsRoutesTabs("/admin")} />
      <RoutesManager canManage={canDispatch} />
    </div>
  );
}
