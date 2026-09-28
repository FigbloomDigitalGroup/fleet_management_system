"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { CompanyRecord } from "../../types/auth";
import { usePageHeader } from "../../components/DashboardShell";

const FleetMap = dynamic(() => import("../../components/FleetMap"), { ssr: false });

export default function CompanyLiveMapPage() {
  const [company, setCompany] = useState<CompanyRecord | null>(null);

  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me").then(setCompany).catch(() => {});
  }, []);

  usePageHeader("Live Map", "Real-time overview of your fleet");

  return (
    <div>
      <FleetMap basePath="/company/vehicles" savedStartPoint={company?.dailyStartPoint ?? null} />
    </div>
  );
}