"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { apiRequest } from "../../../lib/api";
import { TripRecord } from "../../../types/auth";
import FullPageLoading from "../../../components/FullPageLoading";
import CompanyTripReplayMap from "../../../components/CompanyTripReplayMap";

export default function CompanyTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<TripRecord>(`/api/trips/${id}`)
      .then(setTrip)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <FullPageLoading label="Loading trip" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!trip) return null;

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <FiArrowLeft size={14} /> Back
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Trip — {trip.vehicleId?.plateNumber || "Unknown vehicle"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{new Date(trip.startTime).toLocaleString()}</p>
        </div>
        <span
          className={`text-xs px-3 py-1.5 rounded-full border font-medium ${trip.endTime
              ? "bg-gray-100 text-gray-500 border-gray-200"
              : "bg-teal-50 text-teal-600 border-teal-200"
            }`}
        >
          {trip.endTime ? "completed" : "in progress"}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 max-w-xl mb-6">
        <p className="text-xs text-teal-600 mb-3">Key details recorded for this trip</p>
        <dl className="grid grid-cols-2 gap-5 text-sm">
          <div>
            <dt className="text-gray-500">Vehicle</dt>
            <dd className="text-gray-900 font-medium mt-0.5">{trip.vehicleId?.plateNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Driver</dt>
            <dd className="text-gray-900 font-medium mt-0.5">{trip.driverId?.fullName || "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Start time</dt>
            <dd className="text-gray-900 font-medium mt-0.5">{new Date(trip.startTime).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">End time</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {trip.endTime ? new Date(trip.endTime).toLocaleString() : "Still in progress"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Distance</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {trip.distanceKm ? `${trip.distanceKm.toFixed(1)} km` : "Not yet calculated"}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Journey replay</h3>
        <CompanyTripReplayMap tripId={trip._id} />
      </div>
    </div>
  );
}