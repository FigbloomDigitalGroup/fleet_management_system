"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiArrowLeft, FiBell, FiChevronLeft, FiLogOut, FiMapPin, FiMenu } from "react-icons/fi";
import { FaMapMarkerAlt } from "react-icons/fa";
import { FaLocationPinLock } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext";
import { useAdminAccess } from "../lib/adminAccess";
import { FleetNav, fleetNav, isNavItemActive, navHomeHref, platformNav } from "../lib/fleetNav";
import { apiRequest } from "../lib/api";
import Avatar from "./Avatar";
import ImageUploadButton from "./ImageUploadButton";
import { industryLabel } from "../lib/industries";
import { PageHeaderContext, PageHeaderValue } from "./PageHeader";
import { useShellData } from "./useShellData";
import AlertToastStack from "./AlertToast";
import AgentChatWidget from "./AgentChatWidget";
import SessionExpiredModal from "./SessionExpiredModal";
import OverviewSlides from "./OverviewSlides";
import VehicleAssignmentPanel from "./VehicleAssignmentPanel";

// The portals' shell, arranged like Traccar's web app:
// - on the company side the Live Map is a full-screen page with its own
//   floating card (see FleetMap), so the shell adds nothing around it;
// - every other page belongs to a section (Reports / Dispatch / Settings, or
//   for the platform owner Reports / Companies / Settings) and gets that
//   section's left menu beside it.
// A bottom menu (Map when there is one + the sections + Log out) moves
// between them.

interface ShellContextValue {
  nav: FleetNav;
  alertCount: number;
  unreadMessages: number;
  companyName: string | null;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useAppShell() {
  return useContext(ShellContext);
}

export function BottomMenu({ dark = false }: { dark?: boolean }) {
  const shell = useAppShell();
  const pathname = usePathname();
  const { logout } = useAuth();
  if (!shell) return null;
  const { nav } = shell;

  const entries = [
    ...(nav.mapHref ? [{ key: "map", label: "Map", icon: FiMapPin, href: nav.mapHref, active: pathname === nav.mapHref }] : []),
    ...nav.sections.map((s) => ({
      key: s.key,
      label: s.label,
      icon: s.icon,
      href: s.items[0].href,
      active: s.items.some((i) => isNavItemActive(pathname, i.href)),
    })),
  ];
  const base = "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors";
  const idle = dark ? "text-teal-100/70 hover:text-white" : "text-gray-500 hover:text-gray-800";
  const on = dark ? "text-white" : "text-teal-700";

  return (
    <div className={`flex border-t ${dark ? "border-teal-900" : "border-gray-100"}`}>
      {entries.map((e) => {
        const Icon = e.icon;
        return (
          <Link key={e.key} href={e.href} className={`${base} ${e.active ? on : idle}`}>
            <Icon size={17} />
            {e.label}
          </Link>
        );
      })}
      <button onClick={logout} className={`${base} ${idle}`}>
        <FiLogOut size={17} />
        Log out
      </button>
    </div>
  );
}

function CountBadge({ count, tone }: { count: number; tone: "red" | "orange" }) {
  if (count <= 0) return null;
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white ${
        tone === "red" ? "bg-red-600" : "bg-orange-500"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function AppShell({ children, portal }: { children: ReactNode; portal: "admin" | "company" | "platform" }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { access, isViewer } = useAdminAccess();
  const isOwner = user?.role === "COMPANY_OWNER";
  const isPlatform = portal === "platform";

  const nav = useMemo(
    () => (isPlatform ? platformNav() : fleetNav(`/${portal}` as "/admin" | "/company", { isOwner, canEditCompany: access === "full" })),
    [isPlatform, portal, isOwner, access]
  );
  const homeHref = navHomeHref(nav);
  const isMap = !!nav.mapHref && pathname === nav.mapHref;
  const section = nav.sections.find((s) => s.items.some((i) => isNavItemActive(pathname, i.href)));
  const activeItem = section?.items.find((i) => isNavItemActive(pathname, i.href));
  // The company-side overview gets Fleet's offer/industry hero card.
  const isOverviewPage = !isPlatform && pathname === `/${portal}/dashboard`;

  const { companyName, companyIndustry, companyLogoUrl, alertCount, toasts, dismissToast, unreadMessages, zoneCounts } =
    useShellData({
      alerts: !!nav.alertsHref,
      messages: !isPlatform,
      // The map works these out itself from its own, faster poll.
      zones: !isPlatform && !isMap,
    });

  // The signed-in person's own name and photo, for the menu footer.
  const [me, setMe] = useState<{ fullName: string; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest<{ fullName: string; avatarUrl?: string | null }>("/api/users/me")
      .then((u) => !cancelled && setMe({ fullName: u.fullName, avatarUrl: u.avatarUrl ?? null }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [header, setHeader] = useState<PageHeaderValue | null>(null);
  const headerContextValue = useMemo(() => ({ header, setHeader }), [header]);
  const shellValue = useMemo(
    () => ({ nav, alertCount, unreadMessages, companyName }),
    [nav, alertCount, unreadMessages, companyName]
  );

  // Desktop: the section menu can be collapsed for more room. Mobile: it's
  // an overlay opened from the title bar, which closes on navigation since
  // it's tied to the page it was opened on.
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === pathname;
  const setMobileMenuOpen = (open: boolean) => setMobileMenuPath(open ? pathname : null);

  const overlays = (
    <div className="print:hidden">
      {nav.alertsHref && <AlertToastStack toasts={toasts} onDismiss={dismissToast} liveMapHref={nav.mapHref} />}
      <SessionExpiredModal />
      {!isPlatform && !isViewer && <AgentChatWidget />}
    </div>
  );

  if (isMap) {
    return (
      <ShellContext.Provider value={shellValue}>
        <PageHeaderContext.Provider value={headerContextValue}>
          {overlays}
          <div className="h-screen overflow-hidden">{children}</div>
        </PageHeaderContext.Provider>
      </ShellContext.Provider>
    );
  }

  const title = header?.title ?? activeItem?.label ?? section?.label ?? "";
  const statsAtBottom = header?.position === "bottom";

  // The overview keeps Fleet's hero card (offer slides + industry) beside
  // its stats; every other page just gets a plain title bar, like Traccar.
  const overviewHero = isOverviewPage && (
    <div className={`mb-6 grid gap-4 print:hidden ${header?.stats ? "lg:grid-cols-2" : "grid-cols-1"}`}>
      <div className="relative flex flex-col justify-between overflow-hidden rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="pointer-events-none absolute -right-4 -top-4 grid grid-cols-6 gap-3 opacity-10" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className={`h-2 w-2 bg-teal-600 ${i % 3 === 0 ? "rounded-full" : "rotate-45"}`} />
          ))}
        </div>
        {/* Offer slides on the left, the fleet's vehicle count on the right */}
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="max-w-md">
              <OverviewSlides isOwner={isOwner} />
            </div>
            {companyIndustry && (
              <span className="mt-3 inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-[9px] font-medium uppercase tracking-wide text-teal-600">
                {industryLabel(companyIndustry)}
              </span>
            )}
          </div>
          <div className="hidden h-24 w-px bg-gray-100 sm:block" aria-hidden="true" />
          <VehicleAssignmentPanel vehiclesHref={`/${portal}/vehicles`} />
        </div>
        <p className="relative mt-4 text-right text-[11px] text-blue-950/50">Powered by Movec</p>
      </div>
      {header?.stats && <div className="min-w-0">{header.stats}</div>}
    </div>
  );
  const pageStats = !isOverviewPage && header?.stats && (
    <div className={`print:hidden ${statsAtBottom ? "mt-6" : "mb-6"}`}>{header.stats}</div>
  );

  return (
    <ShellContext.Provider value={shellValue}>
      <div className="flex h-screen overflow-hidden bg-[#f5f6f8] print:block print:h-auto print:overflow-visible">
        {overlays}

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 bg-black/30 md:hidden print:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* SECTION MENU — Traccar's left drawer: back to the map, the
            section's pages, and the bottom menu to switch sections. */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col bg-teal-950 text-white transition-transform print:hidden md:static md:z-auto ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } ${menuCollapsed ? "md:hidden" : "md:translate-x-0"}`}
        >
          <div className="flex items-center gap-2 border-b border-teal-900 px-3 py-3">
            <Link
              href={homeHref}
              title={nav.mapHref ? "Back to the map" : "Back to the start"}
              className="rounded-full p-1.5 text-teal-100 transition-colors hover:bg-teal-900 hover:text-white"
            >
              <FiArrowLeft size={18} />
            </Link>
            <span className="flex-1 text-sm font-semibold">{section?.label}</span>
            <button
              onClick={() => {
                setMenuCollapsed(true);
                setMobileMenuOpen(false);
              }}
              title="Hide menu"
              className="rounded-full p-1.5 text-teal-100 transition-colors hover:bg-teal-900 hover:text-white"
            >
              <FiChevronLeft size={18} />
            </button>
          </div>

          <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
            {section?.items.map((item) => {
              const Icon = item.icon;
              const active = item === activeItem;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded px-3 py-2 text-xs font-medium transition-colors ${
                    active ? "bg-teal-900 text-white" : "text-teal-50 hover:bg-teal-900"
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === "alerts" && <CountBadge count={alertCount} tone="red" />}
                  {item.badge === "messages" && <CountBadge count={unreadMessages} tone="orange" />}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 px-3 pb-3">
            {companyName && (
              <div className="flex items-center gap-2">
                <Avatar src={companyLogoUrl} name={companyName} size="sm" shape="square" />
                <p className="min-w-0 truncate text-[11px] font-medium text-teal-50">{companyName}</p>
              </div>
            )}
            {me && (
              <div className="flex items-center gap-2 rounded-lg bg-teal-900/60 p-2">
                <Avatar src={me.avatarUrl} name={me.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white">{me.fullName}</p>
                  {/* Platform staff have no company to store an image under */}
                  {!isPlatform && (
                    <ImageUploadButton
                      endpoint="/api/users/me/avatar"
                      kind="avatar"
                      tone="dark"
                      label={me.avatarUrl ? "Change photo" : "Add photo"}
                      hasImage={!!me.avatarUrl}
                      onChange={(avatarUrl) => setMe({ ...me, avatarUrl })}
                    />
                  )}
                </div>
              </div>
            )}
            {access !== "full" && (
              <span
                className="mt-2 inline-block rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-200"
                title={
                  access === "viewer"
                    ? "You can see everything but can't make changes"
                    : "You can manage jobs, routes, messages and alerts"
                }
              >
                {access === "viewer" ? "View-only access" : "Dispatcher access"}
              </span>
            )}
          </div>
          <BottomMenu dark />
        </aside>

        {/* PAGE */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
          <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 print:hidden md:px-6">
            <button
              onClick={() => {
                setMenuCollapsed(false);
                setMobileMenuOpen(true);
              }}
              title="Show menu"
              className={`rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 ${menuCollapsed ? "" : "md:hidden"}`}
            >
              <FiMenu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-blue-950">{title}</h1>
              {header?.subtitle && <p className="truncate text-xs text-gray-500">{header.subtitle}</p>}
            </div>
            {zoneCounts && (
              <div className="hidden items-center gap-2 lg:flex">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-600">
                  <FaMapMarkerAlt size={11} />
                  {zoneCounts.inZone} in zone
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                  <FaLocationPinLock size={11} />
                  {zoneCounts.outOfZone} out of zone
                </span>
              </div>
            )}
            {nav.alertsHref && (
              <Link
                href={nav.alertsHref}
                aria-label="Alerts"
                className="relative rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <FiBell size={19} />
                <span className="absolute -right-0.5 -top-0.5">
                  <CountBadge count={alertCount} tone="red" />
                </span>
              </Link>
            )}
          </header>

          <main className="app-content min-w-0 flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:bg-white print:p-0">
            {overviewHero}
            {!statsAtBottom && pageStats}
            <PageHeaderContext.Provider value={headerContextValue}>{children}</PageHeaderContext.Provider>
            {statsAtBottom && pageStats}
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
