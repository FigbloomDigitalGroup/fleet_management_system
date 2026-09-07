"use client";

import { ReactNode } from "react";
import {
  FiAlertTriangle,
  FiCreditCard,
  FiFileText,
  FiHome,
  FiMapPin,
  FiSettings,
  FiTruck,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardShell from "../components/DashboardShell";



const navItems = [
  { label: "Dashboard", href: "/company/dashboard", icon: FiHome },
  { label: "Admins", href: "/company/admins", icon: FiUserPlus },
  { label: "Live Map", href: "/company/live-map", icon: FiMapPin },
  { label: "Vehicles", href: "/company/vehicles", icon: FiTruck },
  { label: "Drivers", href: "/company/drivers", icon: FiUsers },
  { label: "Trips", href: "/company/trips", icon: FiFileText },
  { label: "Alerts", href: "/company/alerts", icon: FiAlertTriangle },
  { label: "Billing", href: "/company/billing", icon: FiCreditCard },
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



