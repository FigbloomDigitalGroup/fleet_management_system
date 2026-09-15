import GeofencesManager from "../../components/GeofencesManager";

export default function AdminGeofencesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Geofences</h1>
        <p className="text-sm text-gray-500 mt-1">Zones that trigger alerts when vehicles enter or exit</p>
      </div>
      <GeofencesManager canManage={true} />
    </div>
  );
}