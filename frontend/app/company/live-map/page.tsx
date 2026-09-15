"use client";

import dynamic from "next/dynamic";

const FleetMap = dynamic(() => import("../../components/FleetMap"), { ssr: false });

export default function CompanyLiveMapPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-blue-950">Live Map</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time overview of your fleet</p>
      </div>
      <FleetMap />
    </div>
  );
}