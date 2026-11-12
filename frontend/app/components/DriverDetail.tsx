"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import FullPageLoading from "./FullPageLoading";
import WheelIcon from "./WheelIcon";
import { usePageHeader } from "./DashboardShell";
import DriverScoreCard from "./DriverScoreCard";
import DriverDistanceCard from "./DriverDistanceCard";
import { DriverRecord, VehicleRecord } from "../types/auth";
import Avatar from "./Avatar";
import ImageUploadButton from "./ImageUploadButton";
import { useAdminAccess } from "../lib/adminAccess";
import { canManageTeam } from "../lib/staffRoles";
import { useAuth } from "../context/AuthContext";
import CallButton from "./CallButton";

type ProfileField = { key: keyof DriverRecord; label: string };

const PERSONAL_FIELDS: ProfileField[] = [
  { key: "phone", label: "Phone number" },
  { key: "dob", label: "Date of birth" },
  { key: "nationalId", label: "National ID" },
  { key: "address", label: "Home address" },
];

const LICENSE_FIELDS: ProfileField[] = [
  { key: "licenseNumber", label: "License number" },
  { key: "licenseExpiry", label: "License expiry" },
];

const EMERGENCY_FIELDS: ProfileField[] = [
  { key: "emergencyName", label: "Contact name" },
  { key: "emergencyPhone", label: "Contact phone" },
];

const ALL_PROFILE_FIELDS = [...PERSONAL_FIELDS, ...LICENSE_FIELDS, ...EMERGENCY_FIELDS];

function ProfileCard({ title, fields, driver }: { title: string; fields: ProfileField[]; driver: DriverRecord }) {
  return (
    <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <dl className="mt-3 space-y-3 text-sm">
        {fields.map((f) => (
          <div key={f.key}>
            <dt className="text-gray-500">{f.label}</dt>
            <dd className="text-gray-900 font-medium mt-0.5">{(driver[f.key] as string) || "Not set"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// basePath: "/admin" or "/company" — used to link to that role's vehicle
// detail page for the driver's currently assigned vehicle, if any.
export default function DriverDetail({ basePath }: { basePath: string }) {
  const { id } = useParams<{ id: string }>();
  const { canManageFleet } = useAdminAccess();
  const { user } = useAuth();
  const canSwitchOff = canManageTeam(user);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();

  // Switching a driver off signs them out of the app straight away (and, with
  // Figbloom HR on, tells HR they left); switching on lets them back in.
  async function setActive(active: boolean) {
    if (!driver) return;
    if (!active && !window.confirm(`Switch off ${driver.fullName}'s account? They are signed out of the app straight away.`)) return;
    setSwitching(true);
    try {
      await apiRequest(`/api/users/${driver._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: active ? "active" : "inactive" }),
        successMessage: active ? "Driver switched on." : "Driver switched off.",
      });
      setDriver({ ...driver, status: active ? "active" : "inactive" });
    } catch {
      /* shown as a popup */
    } finally {
      setSwitching(false);
    }
  }

  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<DriverRecord>(`/api/users/drivers/${id}`)
      .then(setDriver)
      .catch((err) => setError(err.message || "Failed to load driver"))
      .finally(() => setLoading(false));
    apiRequest<VehicleRecord[]>("/api/vehicles")
      .then((vehicles) => setVehicle(vehicles.find((v) => v.driverId?._id === id) || null))
      .catch(() => {});
  }, [id]);

  usePageHeader(driver?.fullName ?? "Driver", driver?.email);

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!driver) return null;

  const hasProfile = ALL_PROFILE_FIELDS.some((f) => driver[f.key]);

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-4 rounded bg-gray-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600"
      >
        Back
      </button>

      <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
        {/* Profile picture — the driver can also set it from the mobile app */}
        <div className="mb-5 flex items-center gap-4 border-b border-gray-100 pb-5">
          <Avatar src={driver.avatarUrl} name={driver.fullName} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{driver.fullName}</p>
              <CallButton phone={driver.phone} name={driver.fullName} size="xs" />
            </div>
            {canManageFleet ? (
              <div className="mt-1.5">
                <ImageUploadButton
                  endpoint={`/api/users/drivers/${driver._id}/avatar`}
                  kind="avatar"
                  label={driver.avatarUrl ? "Change photo" : "Add photo"}
                  hasImage={!!driver.avatarUrl}
                  onChange={(avatarUrl) => setDriver({ ...driver, avatarUrl })}
                />
              </div>
            ) : (
              <p className="mt-0.5 text-xs text-gray-400">Drivers can set their own photo in the app.</p>
            )}
          </div>
        </div>
        {(driver.status !== "active" || canSwitchOff) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full border px-2 py-0.5 ${
                driver.status === "active" ? "border-teal-200 bg-teal-50 text-teal-600" : "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              {driver.status === "active" ? "Account active" : "Account switched off"}
            </span>
            {canSwitchOff && (
              <button
                type="button"
                onClick={() => setActive(driver.status !== "active")}
                disabled={switching}
                className="font-medium text-gray-600 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {driver.status === "active" ? "Switch off" : "Switch on"}
              </button>
            )}
          </div>
        )}
        <h3 className="text-sm font-medium text-gray-700">Driver details</h3>
        <p className="text-xs text-teal-600 mt-0.5 mb-3">Account info and vehicle assignment</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-900 font-medium mt-0.5">{driver.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-900 font-medium mt-0.5 capitalize">{driver.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Assigned vehicle</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {vehicle ? (
                <Link href={`${basePath}/vehicles/${vehicle._id}`} className="inline-flex items-center gap-2 hover:text-teal-600">
                  <WheelIcon size={16} className="spin-slow shrink-0" />
                  {vehicle.plateNumber}
                </Link>
              ) : (
                "Unassigned"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Added on</dt>
            <dd className="text-gray-900 font-medium mt-0.5">{new Date(driver.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4">
        <DriverScoreCard driverId={driver._id} />
      </div>

      <div className="mt-4">
        <DriverDistanceCard vehicle={vehicle} basePath={basePath} />
      </div>

      {!hasProfile ? (
        <div className="mt-4 bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
          <p className="text-sm text-gray-400">This driver hasn't completed their profile in the mobile app yet.</p>
        </div>
      ) : (
        <div className="mt-4 grid lg:grid-cols-3 gap-4">
          <ProfileCard title="Personal details" fields={PERSONAL_FIELDS} driver={driver} />
          <ProfileCard title="License details" fields={LICENSE_FIELDS} driver={driver} />
          <ProfileCard title="Emergency contact" fields={EMERGENCY_FIELDS} driver={driver} />
        </div>
      )}
    </div>
  );
}
