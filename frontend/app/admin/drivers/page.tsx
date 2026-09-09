import DriversList from "../../components/DriversList";

export default function AdminDriversPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-blue-950">Drivers</h1>
        <p className="text-sm text-gray-500 mt-1">Add drivers and assign them to vehicles</p>
      </div>
      <DriversList canAdd={true} canAssignVehicle={true} />
    </div>
  );
}