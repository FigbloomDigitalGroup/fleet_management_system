"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { industryLabel } from "../lib/industries";
import { offerLabel } from "../lib/pricing";
import OverviewSlides from "./OverviewSlides";
import { IconType } from "react-icons";
import { FiBell } from "react-icons/fi";
import { FaMapMarkerAlt } from "react-icons/fa";
import BrandIcon from "./BrandIcon";
import WheelIcon from "./WheelIcon";
import { FaLocationPinLock } from "react-icons/fa6";
import AlertToastStack from "./AlertToast";
import AgentChatWidget from "./AgentChatWidget";
import SessionExpiredModal from "./SessionExpiredModal";
import { useAdminAccess } from "../lib/adminAccess";
import { PageHeaderContext, PageHeaderValue } from "./PageHeader";
import { useShellData } from "./useShellData";

export { usePageHeader } from "./PageHeader";

interface NavItem {
  label: string;
  href: string;
  icon: IconType;
}

export default function DashboardShell({
  children,
  navItems,
  title,
}: {
  children: ReactNode;
  navItems: NavItem[];
  title: string;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { access, isViewer } = useAdminAccess();
  const alertsHref = navItems.find((item) => item.label === "Alerts")?.href;
  const messagesHref = navItems.find((item) => item.label === "Messages")?.href;
  const activeNavLabel = navItems.find((item) => item.href === pathname)?.label;
  const isOverviewPage =
    pathname === "/admin/dashboard" || pathname === "/company/dashboard" || pathname === "/platform/dashboard";
  const [header, setHeader] = useState<PageHeaderValue | null>(null);
  const headerContextValue = useMemo(() => ({ header, setHeader }), [header]);
  const bannerTitle = header?.title ?? activeNavLabel ?? title;
  const bannerSubtitle = header?.subtitle;

  const { companyName, companyIndustry, alertCount, toasts, dismissToast, unreadMessages, zoneCounts } = useShellData({
    alerts: !!alertsHref,
    messages: !!messagesHref,
    zones: true,
  });

  const heroAtBottom = header?.position === "bottom";
  const showSlidesInHero = isOverviewPage && (user?.role === "COMPANY_OWNER" || user?.role === "ADMIN");

  // Hero banner — present on every page; takes half the row once a page
  // supplies stats to fill the other half, full width otherwise. Normally
  // sits above the page content; `position: "bottom"` puts it below.
  const heroRow = (
    <div
      className={`grid gap-4 print:hidden ${heroAtBottom ? "mt-6" : "mb-6"} ${header?.stats ? "lg:grid-cols-2" : "grid-cols-1"}`}
    >
      {/* Styled to match the white stat cards beside it */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div
          className="pointer-events-none absolute -right-4 -top-4 grid grid-cols-6 gap-3 opacity-10"
          aria-hidden="true"
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className={`h-2 w-2 bg-teal-600 ${i % 3 === 0 ? "rounded-full" : "rotate-45"}`} />
          ))}
        </div>
        {isOverviewPage && (
          <WheelIcon
            className="spin-slow pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-teal-600/20"
            size={72}
          />
        )}
        <div className="relative max-w-md">
          {/* Company-side overview cards sweep through the special offer and
              what FIGBLOOM FLEET offers, in place of the "Fleet Overview"
              title. Platform staff aren't upsold, so they keep the title. */}
          {showSlidesInHero ? (
            <OverviewSlides isOwner={user?.role === "COMPANY_OWNER"} />
          ) : (
            <>
              <h2 className="text-[17px] font-bold text-blue-950">{bannerTitle}</h2>
              {bannerSubtitle && <p className="mt-1 text-[11px] font-bold text-teal-600">{bannerSubtitle}</p>}
            </>
          )}
          {isOverviewPage && companyIndustry && (
            <span className="mt-3 inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-[9px] font-medium uppercase tracking-wide text-teal-600">
              {industryLabel(companyIndustry)}
            </span>
          )}
        </div>
        <p className="relative mt-4 text-right text-[11px] text-blue-950/50">Powered by Movec</p>
      </div>

      {header?.stats && <div className="min-w-0">{header.stats}</div>}
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-white flex print:block print:h-auto print:overflow-visible">
      <div className="print:hidden">
        <AlertToastStack
          toasts={toasts}
          onDismiss={dismissToast}
          liveMapHref={
            user?.role === "ADMIN" ? "/admin/live-map" : user?.role === "COMPANY_OWNER" ? "/company/live-map" : null
          }
        />
        <SessionExpiredModal />
        {(user?.role === "ADMIN" || user?.role === "COMPANY_OWNER") && !isViewer && <AgentChatWidget />}
      </div>

      {/* SIDEBAR */}
      {/* The company portal's long nav still scrolls on short screens, but
          without a visible scrollbar (no-scrollbar, globals.css). */}
      <aside
        className={`h-screen w-40 shrink-0 overflow-y-auto bg-teal-950 flex flex-col text-white print:hidden ${
          user?.role === "COMPANY_OWNER" ? "no-scrollbar" : ""
        }`}
      >
        <div className="px-3 py-4">
          <span className="flex items-center gap-1.5 text-xs font-bold text-white whitespace-nowrap">
            <BrandIcon variant="light" className="h-4 w-4 shrink-0" />
            FIGBLOOM FLEET
          </span>
          <p className="text-[9px] text-white mt-0.5">{title}</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            const isAgent = item.label === "AI Agent";
            const isAlerts = item.label === "Alerts";
            const isMessages = item.label === "Messages";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-2 py-2 rounded text-[10px] font-medium transition-colors ${active
                  ? "bg-teal-900 text-white"
                  : "text-white hover:bg-teal-900"
                  }`}
              >
                {isAgent ? (
                  <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-50" />
                    <Icon size={14} className="relative" />
                  </span>
                ) : (
                  <Icon size={14} className="shrink-0" />
                )}
                <span className="flex-1">{item.label}</span>
                {isAlerts && alertCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                    {alertCount > 99 ? "99+" : alertCount}
                  </span>
                )}
                {isMessages && unreadMessages > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-medium text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* MAIN CONTENT */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        {/* FLOATING HEADER — holds the current page's title, pinned above the scroll */}
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between bg-blue-50 px-6 py-4 print:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {companyName && (
              <span className="shrink-0 rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                {companyName}
              </span>
            )}
            {/* Limited admins see why some buttons are missing */}
            {access !== "full" && (
              <span
                className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600"
                title={
                  access === "viewer"
                    ? "You can see everything but can't make changes"
                    : "You can manage jobs, routes, messages and alerts"
                }
              >
                {access === "viewer" ? "View-only access" : "Dispatcher access"}
              </span>
            )}

            {/* Promo banner — fills most of the blank space between the
                company pill and the header's right-side controls. Only makes
                sense for company-side roles; platform staff aren't a
                billing customer being upsold to. */}
            {(user?.role === "COMPANY_OWNER" || user?.role === "ADMIN") && (
              <div className="relative h-10 w-3/4 max-w-2xl shrink overflow-hidden rounded-full bg-teal-950 shadow-sm">
                <div className="relative flex h-full items-center gap-2 px-4">
                  <span className="animate-shake inline-block rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Special offer
                  </span>
                  <span className="truncate text-xs font-medium text-white">
                    FIGBLOOM FLEET — {offerLabel()}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {zoneCounts && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-600">
                  <FaMapMarkerAlt size={11} />
                  {zoneCounts.inZone} in zone
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600">
                  <FaLocationPinLock size={11} />
                  {zoneCounts.outOfZone} out of zone
                </span>
              </div>
            )}
            {alertsHref && (
              <Link
                href={alertsHref}
                aria-label="Alerts"
                className="relative rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <FiBell size={20} />
                {alertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                    {alertCount > 99 ? "99+" : alertCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={logout}
              className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="app-content min-w-0 flex-1 overflow-y-auto bg-[#f5f6f8] p-6 print:overflow-visible print:bg-white print:p-0">
          {!heroAtBottom && heroRow}
          <PageHeaderContext.Provider value={headerContextValue}>{children}</PageHeaderContext.Provider>
          {heroAtBottom && heroRow}
        </main>
      </div>
    </div>
  );
}