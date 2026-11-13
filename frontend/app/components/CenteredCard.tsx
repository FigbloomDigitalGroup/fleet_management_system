import { ReactNode } from "react";
import BrandIcon from "./BrandIcon";

// A plain page with one card in the middle, for the account pages outside
// the dashboards (invitation, no fleet, new fleet).
export default function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <span className="mb-6 flex items-center gap-2 text-lg font-bold text-teal-900">
        <BrandIcon className="h-6 w-6" />
        FIGBLOOM FLEET
      </span>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="mb-3 text-lg font-semibold text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}
