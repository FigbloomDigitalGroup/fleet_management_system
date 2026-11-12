import { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiClipboard,
  FiCpu,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiMap,
  FiMapPin,
  FiMessageSquare,
  FiPackage,
  FiSliders,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { IoCarSportSharp } from "react-icons/io5";

// One flat menu per role, always visible on desktop and the same list in the
// phone drawer. Each item's label is also the title of the page it opens, so
// "where am I" and "where do I click" always use the same words.

export interface FleetNavItem {
  label: string;
  href: string;
  icon: IconType;
  badge?: "alerts" | "messages";
  // Other pages that belong to this item (e.g. Routes under "Jobs & routes"),
  // so the item stays highlighted there.
  also?: string[];
}

export interface FleetNav {
  // The company side has a live map page; the staff area doesn't.
  mapHref: string | null;
  alertsHref: string | null;
  items: FleetNavItem[];
  // Up to four items repeated in the phone tab bar (the rest are one tap
  // away in the drawer, which lists everything).
  tabs: string[];
}

export function navHomeHref(nav: FleetNav) {
  return nav.items[0].href;
}

// Figbloom staff's area (/platform), in plain words: the customer fleets
// first, billing and settings after. Vehicles, drivers and the live map live
// inside each fleet (open one from Customer fleets to see it read-only).
export function platformNav(): FleetNav {
  return {
    mapHref: null,
    alertsHref: null,
    items: [
      { label: "Staff home", href: "/platform/dashboard", icon: FiHome },
      { label: "Customer fleets", href: "/platform/companies", icon: FiBriefcase },
      { label: "Fleet reports", href: "/platform/analytics", icon: FiBarChart2 },
      { label: "AI checks", href: "/platform/agent", icon: FiCpu },
      { label: "Billing", href: "/platform/billing", icon: FiCreditCard },
      { label: "Settings", href: "/platform/settings", icon: FiSliders },
    ],
    tabs: ["/platform/dashboard", "/platform/companies", "/platform/analytics", "/platform/billing"],
  };
}

export function fleetNav(
  base: "/admin" | "/company",
  { isOwner, canEditCompany, supportView = false }: { isOwner: boolean; canEditCompany: boolean; supportView?: boolean }
): FleetNav {
  const items: FleetNavItem[] = [
    { label: "Overview", href: `${base}/dashboard`, icon: FiHome },
    { label: "Live map", href: `${base}/live-map`, icon: FiMapPin },
    { label: "Vehicles", href: `${base}/vehicles`, icon: IoCarSportSharp },
    { label: "Drivers", href: `${base}/drivers`, icon: FiUsers },
    { label: "Trips", href: `${base}/trips`, icon: FiFileText },
    { label: "Jobs & routes", href: `${base}/jobs`, icon: FiPackage, also: [`${base}/routes`] },
    { label: "Geofences", href: `${base}/geofences`, icon: FiMap },
    { label: "Alerts", href: `${base}/alerts`, icon: FiAlertTriangle, badge: "alerts", also: [`${base}/agent`] },
    { label: "Expenses", href: `${base}/expenses`, icon: FiDollarSign },
    { label: "Inspections & maintenance", href: `${base}/inspections`, icon: FiClipboard },
    { label: "Reports", href: `${base}/reports`, icon: FiBarChart2 },
    { label: "Messages", href: `${base}/messages`, icon: FiMessageSquare, badge: "messages" },
    ...(isOwner ? [{ label: "Admins", href: `${base}/admins`, icon: FiUserPlus }] : []),
    // Billing isn't shown to Figbloom staff in a support view.
    ...(isOwner && !supportView ? [{ label: "Billing", href: `${base}/billing`, icon: FiCreditCard }] : []),
    ...(canEditCompany ? [{ label: "Settings", href: `${base}/settings`, icon: FiSliders }] : []),
  ];

  return {
    mapHref: `${base}/live-map`,
    alertsHref: `${base}/alerts`,
    items,
    tabs: [`${base}/dashboard`, `${base}/live-map`, `${base}/vehicles`, `${base}/alerts`],
  };
}

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavItem(nav: FleetNav, pathname: string) {
  return nav.items.find((i) => [i.href, ...(i.also ?? [])].some((h) => isNavItemActive(pathname, h)));
}
