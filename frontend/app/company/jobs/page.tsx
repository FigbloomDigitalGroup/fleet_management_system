"use client";

import JobsBoard from "../../components/JobsBoard";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyJobsPage() {
  usePageHeader("Jobs", "Plan the day's deliveries and visits, and share live ETAs with customers");

  return (
    <div>
      <JobsBoard />
    </div>
  );
}
