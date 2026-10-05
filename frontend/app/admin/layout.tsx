"use client";

import { ReactNode } from "react";
import { FiHome, FiUsers, FiMapPin, FiAlertTriangle, FiFileText, FiMap, FiCpu, FiNavigation, FiDollarSign } from "react-icons/fi";
import { IoCarSportSharp } from "react-icons/io5";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";

const navItems = [
  { label: "Overview", href: "/admin/dashboard", icon: FiHome },
  { label: "Live Map", href: "/admin/live-map", icon: FiMapPin },
  { label: "Geofences", href: "/admin/geofences", icon: FiMap },
  { label: "Routes", href: "/admin/routes", icon: FiNavigation },
  { label: "Vehicles", href: "/admin/vehicles", icon: IoCarSportSharp },
  { label: "Drivers", href: "/admin/drivers", icon: FiUsers },
  { label: "Trips", href: "/admin/trips", icon: FiFileText },
  { label: "Expenses", href: "/admin/expenses", icon: FiDollarSign },
  { label: "Alerts", href: "/admin/alerts", icon: FiAlertTriangle },
  { label: "AI Agent", href: "/admin/agent", icon: FiCpu },
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