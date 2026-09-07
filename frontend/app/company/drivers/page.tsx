import DriversList from "../../components/DriversList";

export default function CompanyDriversPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
        <p className="text-sm text-gray-500 mt-1">Drivers registered under your fleet and their vehicles</p>
      </div>
      <DriversList canAdd={false} canAssignVehicle={false} />
    </div>
  );
}


