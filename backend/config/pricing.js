// KES per vehicle / month for the two self-serve paid plans — the single
// source of truth for what Basic/Pro actually cost. Used by billingController
// (what gets charged) and companyController (expense estimates). Must match
// frontend/app/lib/pricing.ts, which is for display only.
export const PLAN_PRICING_KES = {
  basic: 2250,
  pro: 3800,
};

// The "special offer" promoted in the dashboard header, the landing page,
// and the billing page — a real, honored discount, not just marketing copy.
// Applied here so checkout actually charges the discounted amount; mirrored
// in frontend/app/lib/pricing.ts for display.
export const SPECIAL_OFFER = {
  plan: "pro",
  discountPercent: 20,
  active: true,
};

export function priceForPlan(plan) {
  const base = PLAN_PRICING_KES[plan];
  if (!SPECIAL_OFFER.active || SPECIAL_OFFER.plan !== plan) return base;
  return Math.round(base * (1 - SPECIAL_OFFER.discountPercent / 100));
}
