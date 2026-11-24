import type { Metadata } from "next";
import { ReactNode } from "react";

// The tab Figbloom HR opens in (lib/hrLaunch.ts): no Fleet menu, just the
// "connecting" screen until HR takes over.
export const metadata: Metadata = {
  title: "Opening Figbloom HR · FIGBLOOM FLEET",
  robots: { index: false, follow: false },
};

export default function HrLaunchLayout({ children }: { children: ReactNode }) {
  return children;
}
