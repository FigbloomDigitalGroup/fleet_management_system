// Mirrors the Vehicle.vehicleType enum in backend/models/Vehicle.js — keep in sync.
// One shared list covering every industry the platform serves, rather than a
// per-industry restricted subset — any company can pick any type.
export const VEHICLE_TYPES: { value: string; label: string }[] = [
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
  { value: "bus", label: "Bus" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "tractor", label: "Tractor" },
  { value: "excavator", label: "Excavator" },
  { value: "crane", label: "Crane" },
  { value: "dump_truck", label: "Dump truck" },
  { value: "tanker", label: "Tanker" },
  { value: "armored_vehicle", label: "Armored vehicle" },
  { value: "trailer", label: "Trailer" },
];

export function vehicleTypeLabel(value: string | undefined | null) {
  return VEHICLE_TYPES.find((t) => t.value === value)?.label ?? "Car";
}
