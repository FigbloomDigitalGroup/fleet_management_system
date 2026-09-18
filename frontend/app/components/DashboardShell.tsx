"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { CompanyRecord, AlertRecord } from "../types/auth";
import { IconType } from "react-icons";
import { FiBell } from "react-icons/fi";
import { FaCog } from "react-icons/fa";
import AlertToastStack, { ToastAlert } from "./AlertToast";
import AgentChatWidget from "./AgentChatWidget";

interface NavItem {
  label: string;
  href: string;
  icon: IconType;
}

interface PageHeaderValue {
  title: string;
  subtitle?: string;
  stats?: ReactNode;
}

interface PageHeaderContextType {
  header: PageHeaderValue | null;
  setHeader: (header: PageHeaderValue | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | null>(null);

// Lets any page pinned inside DashboardShell put its title/subtitle/stats in
// the hero banner instead of building its own. `stats` is optional page
// content (e.g. a couple of StatCards) rendered beside the banner — the
// page controls its own grid/flex layout for it.
export function usePageHeader(title: string, subtitle?: string, stats?: ReactNode) {
  const ctx = useContext(PageHeaderContext);
  const setHeader = ctx?.setHeader;

  useEffect(() => {
    setHeader?.({ title, subtitle, stats });
    return () => setHeader?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeader, title, subtitle, stats]);
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
  const alertsHref = navItems.find((item) => item.label === "Alerts")?.href;
  const activeNavLabel = navItems.find((item) => item.href === pathname)?.label;
  const [header, setHeader] = useState<PageHeaderValue | null>(null);
  const headerContextValue = useMemo(() => ({ header, setHeader }), [header]);
  const bannerTitle = header?.title ?? activeNavLabel ?? title;
  const bannerSubtitle = header?.subtitle;

  // Company name shown in the header on every page — fetched once here so
  // company owners and admins don't have to re-fetch it per page.
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "COMPANY_OWNER" && user?.role !== "ADMIN") return;
    let cancelled = false;
    apiRequest<CompanyRecord>("/api/companies/me")
      .then((company) => {
        if (!cancelled) setCompanyName(company.name);
      })
      .catch(() => {
        if (!cancelled) setCompanyName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  // Unresolved alert count — shown as a badge on the bell icon, on every page.
  const [alertCount, setAlertCount] = useState(0);

  // New alerts also pop up as a toast at the top of the screen for a few
  // seconds, on top of being recorded in the alerts list and bell badge.
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const seenAlertIds = useRef<Set<string> | null>(null);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((t) => t.id !== id));
  }

  useEffect(() => {
    if (!alertsHref) return;
    let cancelled = false;

    async function loadAlerts() {
      try {
        const alerts = await apiRequest<AlertRecord[]>("/api/alerts");
        if (cancelled) return;
        setAlertCount(alerts.filter((a) => !a.resolved).length);

        const seen = seenAlertIds.current;
        if (seen === null) {
          // First load after mount — establish a baseline so we don't
          // toast every alert that already existed before this session.
          seenAlertIds.current = new Set(alerts.map((a) => a._id));
          return;
        }

        const newAlerts = alerts.filter((a) => !seen.has(a._id));
        if (newAlerts.length > 0) {
          newAlerts.forEach((a) => seen.add(a._id));
          setToasts((current) => [...current, ...newAlerts.map((a) => ({ id: a._id, alert: a }))]);
        }
      } catch {
        if (!cancelled) setAlertCount(0);
      }
    }

    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [alertsHref]);

  return (
    <div className="h-screen overflow-hidden bg-blue-50 flex">
      <AlertToastStack toasts={toasts} onDismiss={dismissToast} />
      {(user?.role === "ADMIN" || user?.role === "COMPANY_OWNER") && <AgentChatWidget />}

      {/* SIDEBAR */}
      <aside className="h-screen w-48 shrink-0 overflow-y-auto bg-blue-950 flex flex-col text-white">
        <div className="px-4 py-4">
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <FaCog aria-hidden="true" />
            FIGBLOOM FLEET
          </span>
          <p className="text-[11px] text-white mt-0.5">{title}</p>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${active
                  ? "bg-blue-900 text-white"
                  : "text-white hover:bg-blue-900"
                  }`}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* MAIN CONTENT */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* FLOATING HEADER — holds the current page's title, pinned above the scroll */}
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between bg-white px-6 py-4">
          <div>{companyName && <p className="text-xs font-medium text-gray-400">{companyName}</p>}</div>
          <div className="flex items-center gap-2">
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
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {/* Hero banner — present on every page; takes half the row once a
              page supplies stats to fill the other half, full width otherwise */}
          <div className={`grid gap-4 mb-6 ${header?.stats ? "lg:grid-cols-2" : "grid-cols-1"}`}>
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-600 p-6 shadow-sm">
              <div
                className="pointer-events-none absolute -right-4 -top-4 grid grid-cols-6 gap-3 opacity-20"
                aria-hidden="true"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <span key={i} className={`h-2 w-2 bg-white ${i % 3 === 0 ? "rounded-full" : "rotate-45"}`} />
                ))}
              </div>
              <div className="relative max-w-md">
                <h2 className="text-xl font-bold text-white">{bannerTitle}</h2>
                {bannerSubtitle && <p className="mt-1 text-sm text-white/80">{bannerSubtitle}</p>}
              </div>
              <p className="relative mt-4 text-right text-[11px] text-white/60">Powered by Movec</p>
            </div>

            {header?.stats && <div className="min-w-0">{header.stats}</div>}
          </div>

          <PageHeaderContext.Provider value={headerContextValue}>{children}</PageHeaderContext.Provider>
        </main>
      </div>
    </div>
  );
}