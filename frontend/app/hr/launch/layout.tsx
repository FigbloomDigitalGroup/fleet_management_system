import type { Metadata } from "next";
import { ReactNode } from "react";

// The tab Figbloom HR opens in (lib/hrLaunch.ts): no Fleet menu, just the
// "Opening Figbloom HR" screen until HR takes over. Same title as HR's own
// /handoff page, so only the address bar changes.
export const metadata: Metadata = {
  title: "Opening Figbloom HR",
  robots: { index: false, follow: false },
};

export default function HrLaunchLayout({ children }: { children: ReactNode }) {
  return children;
}
