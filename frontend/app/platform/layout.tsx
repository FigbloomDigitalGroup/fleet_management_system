"use client";

import { ReactNode } from "react";
import { FiHome, FiBriefcase, FiBarChart2, FiCreditCard, FiSettings } from "react-icons/fi";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";

const navItems = [
  { label: "Dashboard", href: "/platform/dashboard", icon: FiHome },
  { label: "Companies", href: "/platform/companies", icon: FiBriefcase },
  { label: "Analytics", href: "/platform/analytics", icon: FiBarChart2 },
 { label: "Billing", href: "/platform/billing", icon: FiCreditCard },
  { label: "Settings", href: "/platform/settings", icon: FiSettings },
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