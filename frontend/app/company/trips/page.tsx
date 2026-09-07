import TripsList from "../../components/TripsList";

export default function TripsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
        <p className="text-sm text-gray-500 mt-1">Trip history across your fleet</p>
      </div>
      <TripsList />
    </div>
  );
}