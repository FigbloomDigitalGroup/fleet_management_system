"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_URL, apiRequest } from "../lib/api";
import { ExpenseRecord } from "../types/auth";
import { formatKes } from "../lib/pricing";
import Skeleton from "./Skeleton";
import WheelIcon from "./WheelIcon";

const CATEGORY_LABELS: Record<ExpenseRecord["category"], string> = {
  fuel: "Fuel",
  toll: "Toll",
  parking: "Parking",
  repair: "Repair",
  other: "Other",
};

const CATEGORY_STYLES: Record<ExpenseRecord["category"], string> = {
  fuel: "bg-orange-50 text-orange-600 border-orange-200",
  toll: "bg-blue-50 text-blue-600 border-blue-200",
  parking: "bg-purple-50 text-purple-600 border-purple-200",
  repair: "bg-red-50 text-red-600 border-red-200",
  other: "bg-gray-100 text-gray-500 border-gray-200",
};

// Real, driver-logged costs — fuel purchases and other on-the-road spend,
// submitted from the mobile app (see fleet/src/app/(tabs)/expenses.tsx) and
// viewed here by ADMIN/COMPANY_OWNER. Read-only on the web: expenses only
// ever originate from a driver's own submission.
export default function ExpensesList() {
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/admin") ? "/admin/vehicles" : "/company/vehicles";

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [totalKes, setTotalKes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ expenses: ExpenseRecord[]; totalKes: number }>("/api/expenses")
      .then((data) => {
        setExpenses(data.expenses);
        setTotalKes(data.totalKes);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 shadow-sm ring-1 ring-black/5">
        <span className="text-xs text-gray-500">Total logged</span>
        <span className="text-lg font-bold text-gray-900">{formatKes(totalKes)}</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
        {loading && <Skeleton rows={6} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <>
            <p className="text-xs text-teal-600 px-5 pt-4">
              Fuel and other expenses logged by drivers from the mobile app.
            </p>
            <table className="w-full text-sm mt-2">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Vehicle</th>
                  <th className="text-left px-5 py-3 font-medium">Driver</th>
                  <th className="text-left px-5 py-3 font-medium">Category</th>
                  <th className="text-left px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Note</th>
                  <th className="text-left px-5 py-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                      No expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e._id} className="border-t border-gray-100">
                      <td className="px-5 py-3 text-gray-600">{new Date(e.incurredAt).toLocaleString()}</td>
                      <td className="px-5 py-3 text-xs font-bold text-gray-900">
                        {typeof e.vehicleId === "object" ? (
                          <Link
                            href={`${basePath}/${e.vehicleId._id}`}
                            className="inline-flex items-center gap-2 hover:text-teal-600"
                          >
                            <WheelIcon size={16} className="spin-slow shrink-0" />
                            {e.vehicleId.plateNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {typeof e.driverId === "object" && e.driverId ? e.driverId.fullName : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full border ${CATEGORY_STYLES[e.category]}`}>
                          {CATEGORY_LABELS[e.category]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-900 font-medium">{formatKes(e.amount)}</td>
                      <td className="px-5 py-3 text-gray-500">{e.note || "—"}</td>
                      <td className="px-5 py-3">
                        {e.receiptUrl ? (
                          <a
                            href={API_URL + e.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open receipt photo"
                            className="block w-fit"
                          >
                            <img
                              src={API_URL + e.receiptUrl}
                              alt="Receipt"
                              className="h-10 w-10 rounded object-cover ring-1 ring-black/10 hover:ring-teal-600"
                            />
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
