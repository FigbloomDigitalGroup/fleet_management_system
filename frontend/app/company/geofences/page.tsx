import GeofencesManager from "../../components/GeofencesManager";

export default function CompanyGeofencesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Geofences</h1>
        <p className="text-sm text-gray-500 mt-1">Zones your fleet is being monitored against</p>
      </div>
      <GeofencesManager canManage={false} />
    </div>
  );
}