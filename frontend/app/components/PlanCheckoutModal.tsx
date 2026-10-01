"use client";

import { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { apiRequest } from "../lib/api";
import { CompanyRecord } from "../types/auth";

export type SelfServePlan = "basic" | "pro";
export type PaymentMethod = "mpesa" | "paystack";

const PLAN_DETAILS: Record<SelfServePlan, { label: string; price: string; features: string[] }> = {
  basic: {
    label: "Basic",
    price: "$29 per vehicle / month",
    features: [
      "Up to 15 vehicles",
      "Live GPS tracking",
      "Trip history & reports",
      "Speeding & idle alerts",
      "Geofence zones & entry/exit alerts",
    ],
  },
  pro: {
    label: "Pro",
    price: "$49 per vehicle / month",
    features: [
      "Up to 50 vehicles",
      "Everything in Basic",
      "Route deviation alerts",
      "Fuel anomaly detection",
      "Driver behavior alerts",
      "AI fleet assistant chat",
    ],
  },
};

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: "mpesa", label: "M-Pesa" },
  { id: "paystack", label: "Paystack" },
];

type Step = "confirm" | "payment" | "processing" | "success" | "error";

export default function PlanCheckoutModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: SelfServePlan;
  onClose: () => void;
  onSuccess: (company: CompanyRecord) => void;
}) {
  const [step, setStep] = useState<Step>("confirm");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const details = PLAN_DETAILS[plan];

  async function confirmPayment() {
    if (!method) return;
    setStep("processing");
    setError(null);

    // Simulated processing delay — real M-Pesa/Paystack charging isn't wired
    // up yet, this just gives the flow a believable checkout feel.
    await new Promise((resolve) => setTimeout(resolve, 1400));

    try {
      const company = await apiRequest<CompanyRecord>("/api/companies/me/plan", {
        method: "PATCH",
        body: JSON.stringify({ subscriptionPlan: plan, paymentMethod: method }),
      });
      setStep("success");
      onSuccess(company);
    } catch (err: any) {
      setError(err.message || "Something went wrong updating your plan.");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {step === "confirm" && (
          <>
            <p className="text-xs uppercase tracking-wide text-teal-600 font-bold mb-1">Upgrade plan</p>
            <h2 className="text-2xl font-bold text-blue-950 mb-1">{details.label}</h2>
            <p className="text-sm text-gray-500 mb-5">{details.price}</p>

            <ul className="space-y-2 mb-6">
              {details.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <FaCheckCircle className="mt-0.5 shrink-0 text-teal-600" size={14} />
                  {f}
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep("payment")}
                className="px-5 py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "payment" && (
          <>
            <p className="text-xs uppercase tracking-wide text-teal-600 font-bold mb-1">Upgrade plan</p>
            <h2 className="text-xl font-bold text-blue-950 mb-1">Choose how to pay</h2>
            <p className="text-sm text-gray-500 mb-5">
              For {details.label} — {details.price}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMethod(opt.id)}
                  className={`rounded-xl border p-4 text-sm font-medium transition-colors ${
                    method === opt.id
                      ? "border-teal-600 ring-2 ring-teal-600/30 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-gray-400 mb-5">
              Real payment processing isn't live yet — selecting a method here just records your
              preference. No charge will be made.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setStep("confirm")}
                className="px-4 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={confirmPayment}
                disabled={!method}
                className="px-5 py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-10 w-10 rounded-full border-2 border-teal-600 border-t-transparent animate-spin mb-4" />
            <p className="text-sm font-medium text-gray-700">Processing your {method === "mpesa" ? "M-Pesa" : "Paystack"} payment…</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FaCheckCircle className="text-teal-600 mb-4" size={40} />
            <h2 className="text-lg font-bold text-blue-950 mb-1">You're on the {details.label} plan</h2>
            <p className="text-sm text-gray-500 mb-6">
              Paid via {method === "mpesa" ? "M-Pesa" : "Paystack"}. Real charging isn't live yet — this
              was a simulated checkout.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-md text-sm font-medium text-white bg-teal-600 hover:bg-teal-700"
            >
              Done
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-red-600 mb-6">{error}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep("payment")}
                className="px-5 py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
