"use client";

import { ReactNode } from "react";
import { FiHome, FiFileText, FiAlertCircle } from "react-icons/fi";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";

const navItems = [
  { label: "Overview", href: "/driver/dashboard", icon: FiHome },
  { label: "My Trips", href: "/driver/trips", icon: FiFileText },
  { label: "SOS", href: "/driver/sos", icon: FiAlertCircle },
];

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["DRIVER"]}>
      <DashboardShell navItems={navItems} title="Driver">
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}