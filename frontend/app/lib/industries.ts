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

// Slugs that have a real photo saved at public/industries/<slug>.jpg — the
// rest (security_cash_transit, government_municipal, other) still show as
// empty placeholder slots until photos are sent for them too.
export const INDUSTRIES_WITH_IMAGES = [
  "logistics_courier",
  "public_transport",
  "school_transport",
  "construction",
  "taxi_ride_hailing",
  "agriculture",
  "oil_gas",
  "rental_car",
];

export function industryHasImage(value: string | undefined | null) {
  return !!value && INDUSTRIES_WITH_IMAGES.includes(value);
}
