"use client";

import { ReactNode } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import AppShell from "../components/AppShell";
import { FleetThemeProvider } from "../context/FleetThemeContext";

// Navigation lives in lib/fleetNav.ts — the Live Map is home, everything
// else sits in the Reports / Dispatch / Settings sections.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <FleetThemeProvider>
        <AppShell portal="admin">{children}</AppShell>
      </FleetThemeProvider>
    </ProtectedRoute>
  );
}
