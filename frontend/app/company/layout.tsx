"use client";

import { ReactNode } from "react";
import { FiHome, FiUserPlus } from "react-icons/fi";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";

const navItems = [
  { label: "Dashboard", href: "/company/dashboard", icon: FiHome },
  { label: "Admins", href: "/company/admins", icon: FiUserPlus },
];

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["COMPANY_OWNER"]}>
      <DashboardShell navItems={navItems} title="Company">
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}