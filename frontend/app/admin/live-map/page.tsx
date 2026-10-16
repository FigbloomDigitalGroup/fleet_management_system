"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import { findContainingGeofence } from "../../lib/geofence";
import { CompanyRecord, GeofenceRecord } from "../../types/auth";
import StartPointPanel from "../../components/StartPointPanel";
import { useAdminAccess } from "../../lib/adminAccess";

const FleetMap = dynamic(() => import("../../components/FleetMap"), { ssr: false });

interface LatLng {
  lat: number;
  lng: number;
}

export default function AdminLiveMapPage() {
  const { canManageFleet } = useAdminAccess();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  // Only auto-opens the first time we learn there's no starting point set
  // yet — once one exists (here or from a previous visit) it stays tucked
  // away behind the "Set driver starting point" button.
  const [panelOpen, setPanelOpen] = useState(false);
  const hasDecidedAutoOpen = useRef(false);
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me")
      .then((c) => {
        setCompany(c);
        if (!hasDecidedAutoOpen.current) {
          hasDecidedAutoOpen.current = true;
          setPanelOpen(!c.dailyStartPoint);
        }
      })
      .catch(() => {});
    apiRequest<GeofenceRecord[]>("/api/geofences").then(setGeofences).catch(() => {});
  }, []);

  const savedPoint = company?.dailyStartPoint ?? null;
  const zoneName = pickedPoint ? findContainingGeofence(pickedPoint.lat, pickedPoint.lng, geofences)?.name ?? null : null;

  async function handleSave() {
    if (!pickedPoint) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<CompanyRecord>("/api/companies/me/start-point", {
        method: "PATCH",
        body: JSON.stringify(pickedPoint),
      });
      setCompany(updated);
      setPickedPoint(null);
    } catch (err: any) {
      setError(err.message || "Failed to save starting point");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <FleetMap
        pickMode={canManageFleet && panelOpen}
        savedStartPoint={savedPoint}
        pickedStartPoint={pickedPoint}
        onPickStartPoint={(point) => {
          setPickedPoint(point);
          setError(null);
        }}
        mapOverlay={
          // The start point is a company setting — limited admins can't change it.
          canManageFleet && (
          <StartPointPanel
            open={panelOpen}
            pickedPoint={pickedPoint}
            savedPoint={savedPoint}
            zoneName={zoneName}
            onClose={() => setPanelOpen(false)}
            onReopen={() => setPanelOpen(true)}
            onSave={handleSave}
            saving={saving}
            error={error}
          />
          )
        }
      />
    </div>
  );
}
