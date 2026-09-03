"use client";

import { ReactNode } from "react";
import { FiHome, FiTruck, FiUsers, FiMapPin, FiAlertTriangle, FiFileText } from "react-icons/fi";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: FiHome },
  { label: "Live Map", href: "/admin/live-map", icon: FiMapPin },
  { label: "Vehicles", href: "/admin/vehicles", icon: FiTruck },
  { label: "Drivers", href: "/admin/drivers", icon: FiUsers },
  { label: "Trips", href: "/admin/trips", icon: FiFileText },
  { label: "Alerts", href: "/admin/alerts", icon: FiAlertTriangle },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <DashboardShell navItems={navItems} title="Fleet Admin">
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}