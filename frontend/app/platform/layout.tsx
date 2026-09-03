"use client";

import { ReactNode } from "react";
import { FiHome, FiBriefcase } from "react-icons/fi";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";

const navItems = [
  { label: "Dashboard", href: "/platform/dashboard", icon: FiHome },
  { label: "Companies", href: "/platform/companies", icon: FiBriefcase },
];

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["PLATFORM_ADMIN"]}>
      <DashboardShell navItems={navItems} title="Platform">
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}