"use client";

import { useEffect, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { apiRequest } from "../lib/api";
import { CompanyRecord } from "../types/auth";
import { priceForPlan, formatKes } from "../lib/pricing";

export type SelfServePlan = "basic" | "pro";

const PLAN_DETAILS: Record<SelfServePlan, { label: string; features: string[] }> = {
  basic: {
    label: "Basic",
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

type Step = "confirm" | "processing" | "success" | "error";

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction: (
        accessCode: string,
        callbacks: {
          onSuccess?: (transaction: { reference: string }) => void;
          onCancel?: () => void;
          onError?: (error: { message?: string }) => void;
        }
      ) => void;
    };
  }
}

const PAYSTACK_INLINE_SRC = "https://js.paystack.co/v2/inline.js";

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const existing = document.querySelector(`script[src="${PAYSTACK_INLINE_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Paystack")));
      return;
    }
    const script = document.createElement("script");
    script.src = PAYSTACK_INLINE_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack"));
    document.body.appendChild(script);
  });
}

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
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);

  const details = PLAN_DETAILS[plan];

  useEffect(() => {
    loadPaystackScript().catch(() => {
      // Non-fatal at mount — surfaced only if the user actually tries to pay.
    });
  }, []);

  async function startCheckout() {
    setStep("processing");
    setError(null);

    try {
      await loadPaystackScript();
      if (!window.PaystackPop) {
        throw new Error("Payment provider failed to load. Check your connection and try again.");
      }

      const checkout = await apiRequest<{ accessCode: string; reference: string; amount: number; currency: string }>(
        "/api/billing/checkout",
        { method: "POST", body: JSON.stringify({ plan }) }
      );
      setAmount(checkout.amount);

      const popup = new window.PaystackPop();
      popup.resumeTransaction(checkout.accessCode, {
        onSuccess: async () => {
          try {
            await apiRequest(`/api/billing/verify/${checkout.reference}`);
            const company = await apiRequest<CompanyRecord>("/api/companies/me");
            setStep("success");
            onSuccess(company);
          } catch (err: any) {
            setError(err.message || "Payment went through, but we couldn't confirm it yet. Refresh in a moment.");
            setStep("error");
          }
        },
        onCancel: () => {
          setStep("confirm");
        },
        onError: (err) => {
          setError(err.message || "Payment failed. Please try again.");
          setStep("error");
        },
      });
    } catch (err: any) {
      setError(err.message || "Couldn't start checkout. Please try again.");
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
            <p className="text-sm text-gray-500 mb-5">{formatKes(priceForPlan(plan))} per vehicle / month</p>

            <ul className="space-y-2 mb-6">
              {details.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <FaCheckCircle className="mt-0.5 shrink-0 text-teal-600" size={14} />
                  {f}
                </li>
              ))}
            </ul>

            <p className="text-[11px] text-gray-400 mb-5">
              You'll pay by card or M-Pesa on the next screen, via Paystack. The amount is calculated from
              your current vehicle count.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={startCheckout}
                className="px-5 py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
              >
                Continue to payment
              </button>
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-10 w-10 rounded-full border-2 border-teal-600 border-t-transparent animate-spin mb-4" />
            <p className="text-sm font-medium text-gray-700">Opening secure checkout…</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FaCheckCircle className="text-teal-600 mb-4" size={40} />
            <h2 className="text-lg font-bold text-blue-950 mb-1">You're on the {details.label} plan</h2>
            <p className="text-sm text-gray-500 mb-6">
              Payment of {amount ? formatKes(amount) : ""} confirmed.
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
                onClick={startCheckout}
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
