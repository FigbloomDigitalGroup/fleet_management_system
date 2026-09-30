// Mirrors the Company.industry enum in backend/models/Company.js — keep in sync.
export const INDUSTRIES: { value: string; label: string }[] = [
  { value: "logistics_courier", label: "Logistics & courier/delivery" },
  { value: "public_transport", label: "Public/commuter transport" },
  { value: "school_transport", label: "School transport" },
  { value: "construction", label: "Construction & heavy equipment" },
  { value: "taxi_ride_hailing", label: "Taxi / ride-hailing" },
  { value: "security_cash_transit", label: "Security & cash-in-transit" },
  { value: "agriculture", label: "Agriculture" },
  { value: "government_municipal", label: "Government & municipal" },
  { value: "oil_gas", label: "Oil & gas / fuel distribution" },
  { value: "rental_car", label: "Rental car" },
  { value: "other", label: "Other" },
];

export function industryLabel(value: string | undefined | null) {
  return INDUSTRIES.find((i) => i.value === value)?.label ?? "Other";
}
