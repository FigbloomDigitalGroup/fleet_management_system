"use client";

import { ReactNode } from "react";
import DeviceStatusCard from "./DeviceStatusCard";
import VehicleMaintenance from "./VehicleMaintenance";
import InspectionsList from "./InspectionsList";
import VehicleHistoryReplay from "./VehicleHistoryReplay";

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-teal-600">{subtitle}</p>
      {children}
    </div>
  );
}

// The sections both portals' vehicle detail pages share: phone status,
// maintenance, inspections and a free date-range history replay.
export default function VehicleExtras({ vehicleId, canEdit }: { vehicleId: string; canEdit: boolean }) {
  return (
    <div className="mt-4 space-y-4">
      <Section title="Driver phone" subtitle="Last status reported by the driver app on this vehicle">
        <DeviceStatusCard vehicleId={vehicleId} />
      </Section>
      <Section title="History replay" subtitle="Where this vehicle went in any date & time range, with its stops">
        <VehicleHistoryReplay vehicleId={vehicleId} />
      </Section>
      <Section title="Maintenance" subtitle="Odometer, service history and upcoming reminders">
        <VehicleMaintenance vehicleId={vehicleId} canEdit={canEdit} />
      </Section>
      <Section title="Inspections" subtitle="Pre-trip checks submitted from the driver app">
        <InspectionsList vehicleId={vehicleId} />
      </Section>
    </div>
  );
}
