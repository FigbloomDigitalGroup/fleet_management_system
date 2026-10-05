"use client";

import { ReactNode } from "react";
import {
  FiAlertTriangle,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiMapPin,
  FiSettings,
  FiUserPlus,
  FiUsers,
  FiMap,
  FiCpu,
  FiNavigation,
} from "react-icons/fi";
import { IoCarSportSharp } from "react-icons/io5";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";



const navItems = [
  { label: "Overview", href: "/company/dashboard", icon: FiHome },
  { label: "Live Map", href: "/company/live-map", icon: FiMapPin },
  { label: "Geofences", href: "/company/geofences", icon: FiMap },
  { label: "Routes", href: "/company/routes", icon: FiNavigation },
  { label: "Vehicles", href: "/company/vehicles", icon: IoCarSportSharp },
   { label: "Trips", href: "/company/trips", icon: FiFileText },
  { label: "Expenses", href: "/company/expenses", icon: FiDollarSign },
  { label: "Drivers", href: "/company/drivers", icon: FiUsers },
  { label: "Alerts", href: "/company/alerts", icon: FiAlertTriangle },
  { label: "AI Agent", href: "/company/agent", icon: FiCpu },
  { label: "Billing", href: "/company/billing", icon: FiCreditCard },
   { label: "Admins", href: "/company/admins", icon: FiUserPlus },
  { label: "Settings", href: "/company/settings", icon: FiSettings },

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



