import TripsList from "../../components/TripsList";

export default function TripsPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-blue-950">Trips</h1>
        <p className="text-sm text-gray-500 mt-1">Trip history across your fleet</p>
      </div>
      <TripsList />
    </div>
  );
}