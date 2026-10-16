// Per-vehicleType map marker icons — lets a construction company's fleet show
// excavators/cranes/dump trucks while a rental company's shows cars, instead
// of one generic car icon for every vehicle regardless of industry. Mirrors
// Vehicle.vehicleType (see lib/vehicleTypes.ts); any type without a dedicated
// icon here falls back to the generic car icon in VehicleMarker.
export const VEHICLE_TYPE_ICONS: Partial<Record<string, string>> = {
  car: "/vehicle-icons/car.svg",
  van: "/vehicle-icons/van.svg",
  truck: "/vehicle-icons/truck.svg",
  tractor: "/vehicle-icons/tractor.svg",
  excavator: "/vehicle-icons/excavator.svg",
  crane: "/vehicle-icons/crane.svg",
  tanker: "/vehicle-icons/tanker.svg",
  armored_vehicle: "/vehicle-icons/armored_vehicle.svg",
};
