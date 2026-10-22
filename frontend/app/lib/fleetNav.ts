import { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiClipboard,
  FiCpu,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiMap,
  FiMessageSquare,
  FiNavigation,
  FiPackage,
  FiPieChart,
  FiSend,
  FiSettings,
  FiSliders,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { IoCarSportSharp } from "react-icons/io5";

// Navigation for the company-side portals (admin + company owner), laid out
// like Traccar's: the Live Map is home, and everything else lives in one of
// three sections, each a left-menu page with its own items.

export interface FleetNavItem {
  label: string;
  href: string;
  icon: IconType;
  badge?: "alerts" | "messages";
}

export interface FleetNavSection {
  key: "reports" | "dispatch" | "settings";
  label: string;
  icon: IconType;
  items: FleetNavItem[];
}

export interface FleetNav {
  mapHref: string;
  alertsHref: string;
  sections: FleetNavSection[];
}

export function fleetNav(
  base: "/admin" | "/company",
  { isOwner, canEditCompany }: { isOwner: boolean; canEditCompany: boolean }
): FleetNav {
  const reports: FleetNavItem[] = [
    { label: "Overview", href: `${base}/dashboard`, icon: FiHome },
    { label: "Trips", href: `${base}/trips`, icon: FiFileText },
    { label: "Alerts", href: `${base}/alerts`, icon: FiAlertTriangle, badge: "alerts" },
    { label: "Summary", href: `${base}/reports`, icon: FiBarChart2 },
    { label: "Expenses", href: `${base}/expenses`, icon: FiDollarSign },
    { label: "Inspections", href: `${base}/inspections`, icon: FiClipboard },
    { label: "AI Agent", href: `${base}/agent`, icon: FiCpu },
  ];
  const dispatch: FleetNavItem[] = [
    { label: "Jobs", href: `${base}/jobs`, icon: FiPackage },
    { label: "Routes", href: `${base}/routes`, icon: FiNavigation },
    { label: "Messages", href: `${base}/messages`, icon: FiMessageSquare, badge: "messages" },
  ];
  const settings: FleetNavItem[] = [
    { label: "Vehicles", href: `${base}/vehicles`, icon: IoCarSportSharp },
    { label: "Drivers", href: `${base}/drivers`, icon: FiUsers },
    { label: "Geofences", href: `${base}/geofences`, icon: FiMap },
    ...(isOwner
      ? [
          { label: "Admins", href: `${base}/admins`, icon: FiUserPlus },
          { label: "Billing", href: `${base}/billing`, icon: FiCreditCard },
        ]
      : []),
    ...(canEditCompany ? [{ label: "Company", href: `${base}/settings`, icon: FiSliders }] : []),
  ];

  return {
    mapHref: `${base}/live-map`,
    alertsHref: `${base}/alerts`,
    sections: [
      { key: "reports", label: "Reports", icon: FiPieChart, items: reports },
      { key: "dispatch", label: "Dispatch", icon: FiSend, items: dispatch },
      { key: "settings", label: "Settings", icon: FiSettings, items: settings },
    ],
  };
}

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
