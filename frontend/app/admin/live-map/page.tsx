"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { CompanyRecord } from "../../types/auth";

const FleetMap = dynamic(() => import("../../components/FleetMap"), { ssr: false });

export default function AdminLiveMapPage() {
  const [company, setCompany] = useState<CompanyRecord | null>(null);

  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me").then(setCompany).catch(() => {});
  }, []);

  return <FleetMap savedStartPoint={company?.dailyStartPoint ?? null} />;
}
