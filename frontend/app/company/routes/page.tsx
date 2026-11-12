"use client";

import SectionTabs, { jobsRoutesTabs } from "../../components/SectionTabs";
import RoutesManager from "../../components/RoutesManager";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyRoutesPage() {
  usePageHeader("Jobs & routes", "Plan the day's deliveries and visits, and the paths vehicles should follow");

  return (
    <div>
      <SectionTabs tabs={jobsRoutesTabs("/company")} />
      <RoutesManager canManage={true} />
    </div>
  );
}
