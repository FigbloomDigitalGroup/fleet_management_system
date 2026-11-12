"use client";

import { FiBriefcase, FiExternalLink } from "react-icons/fi";

// The Figbloom console, where company approval, suspension and billing are
// decided (the API's PLATFORM_CONSOLE_URL defaults to the same address).
export const FIGBLOOM_CONSOLE_URL = (process.env.NEXT_PUBLIC_FIGBLOOM_CONSOLE_URL || "https://console.figbloom.org").replace(/\/+$/, "");

// What Figbloom staff see on the platform pages before any company exists:
// where companies come from, and where they're managed.
export default function NoCompaniesYet() {
  const registerUrl = typeof window !== "undefined" ? `${window.location.origin}/register` : "/register";
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        <FiBriefcase size={20} />
      </span>
      <p className="text-sm font-medium text-gray-900">No companies yet</p>
      <p className="max-w-md text-xs text-gray-500">
        Vehicle companies sign themselves up at{" "}
        <a href="/register" className="font-medium text-teal-700 hover:underline">
          {registerUrl}
        </a>
        . Approving, suspending and billing them happens in the Figbloom console; once they&apos;re active they show up here
        with their fleet numbers.
      </p>
      <a
        href={FIGBLOOM_CONSOLE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600"
      >
        Open the Figbloom console
        <FiExternalLink size={12} />
      </a>
    </div>
  );
}
