"use client";

import SectionTabs, { jobsRoutesTabs } from "../../components/SectionTabs";
import JobsBoard from "../../components/JobsBoard";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminJobsPage() {
  usePageHeader("Jobs & routes", "Plan the day's deliveries and visits, and the paths vehicles should follow");

  return (
    <div>
      <SectionTabs tabs={jobsRoutesTabs("/admin")} />
      <JobsBoard />
    </div>
  );
}
