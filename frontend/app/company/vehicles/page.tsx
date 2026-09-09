import VehiclesList from "../../components/VehiclesList";

export default function CompanyVehiclesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-950">Vehicles</h1>
        <p className="text-sm text-gray-500 mt-1">Every vehicle registered under your fleet</p>
      </div>
      <VehiclesList basePath="/company/vehicles" canAssignDriver={false} />
    </div>
  );
}



