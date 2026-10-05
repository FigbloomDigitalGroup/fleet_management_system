// KES per vehicle / month for the two self-serve paid plans. Converted from
// the landing page's advertised $29/$49 (~KES 130/USD) and discounted 40%
// for the Kenya price point. Must match backend/controllers/billingController.js's
// PLAN_PRICING_KES — this copy is for display only, the backend is what
// actually charges.
export const PLAN_PRICING_KES: Record<"basic" | "pro", number> = {
  basic: 2250,
  pro: 3800,
};

export function formatKes(amount: number) {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

// Must match backend/config/pricing.js's SPECIAL_OFFER — this copy is for
// display only, the backend is what actually charges the discounted amount.
export const SPECIAL_OFFER = {
  plan: "pro" as const,
  discountPercent: 20,
  active: true,
};

export function offerLabel() {
  return `Upgrade to Pro this month and save ${SPECIAL_OFFER.discountPercent}% on every vehicle.`;
}

export function priceForPlan(plan: "basic" | "pro") {
  const base = PLAN_PRICING_KES[plan];
  if (!SPECIAL_OFFER.active || SPECIAL_OFFER.plan !== plan) return base;
  return Math.round(base * (1 - SPECIAL_OFFER.discountPercent / 100));
}
