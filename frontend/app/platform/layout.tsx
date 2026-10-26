"use client";

import { ReactNode } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import AppShell from "../components/AppShell";

// Same Traccar-style shell as the company portals — navigation lives in
// lib/fleetNav.ts (platformNav): Reports / Companies / Settings.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["PLATFORM_ADMIN"]}>
      <AppShell portal="platform">{children}</AppShell>
    </ProtectedRoute>
  );
}
