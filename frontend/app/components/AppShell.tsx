"use client";

import { MouseEvent, ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { InShellContext } from "./InShell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBell, FiEye, FiHelpCircle, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { FaMapMarkerAlt } from "react-icons/fa";
import { FaLocationPinLock } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext";
import { useAdminAccess } from "../lib/adminAccess";
import { FleetNav, FleetNavItem, activeNavItem, fleetNav, platformNav } from "../lib/fleetNav";
import { canManageTeam } from "../lib/staffRoles";
import { useHrStatus } from "../lib/hrStatus";
import { apiRequest } from "../lib/api";
import Avatar from "./Avatar";
import BrandIcon from "./BrandIcon";
import ImageUploadButton from "./ImageUploadButton";
import { PageHeaderContext, PageHeaderValue } from "./PageHeader";
import { useShellData } from "./useShellData";
import { roleLabel } from "../lib/roleRedirect";
import AlertToastStack from "./AlertToast";
import AgentChatWidget from "./AgentChatWidget";
import SessionExpiredModal from "./SessionExpiredModal";
import FleetSwitcher from "./FleetSwitcher";

// The portals' shell: one flat menu with every page of the role's area,
// always visible on computers (lg and up). On phones and tablets the same
// menu opens as a drawer from the title bar, and a small tab bar along the
// bottom repeats the four most used pages plus "Menu". The live map is an
// ordinary page inside the shell, so the menu never disappears.
//
// The shell is rendered once by each area's layout (company/, admin/,
// platform/) and stays mounted while people move between pages: only the
// content pane changes, and a page that is still loading shows its loader
// inside that pane (InShellContext, loading.tsx), never over the menu.

interface ShellContextValue {
  nav: FleetNav;
  alertCount: number;
  unreadMessages: number;
  companyName: string | null;
  // "Company owner", "Fleet admin · view only", "Figbloom staff"…
  roleName: string;
}

// Who is signed in, where: the company (or the Figbloom platform) and the
// role, shown in the header (desktop) and the menu (phone) so nobody has to
// guess which area they're in.
export function SignedInAs({
  companyName,
  roleName,
  compact = false,
  tone = "light",
}: {
  companyName: string | null;
  roleName: string;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  if (!roleName) return null;
  const dark = tone === "dark";
  return (
    <span className={`inline-flex min-w-0 flex-wrap items-center gap-1.5 ${compact ? "text-[10px]" : "text-xs"}`}>
      {companyName && (
        <span className={`max-w-[14rem] truncate font-medium ${dark ? "text-teal-50" : "text-gray-700"}`}>{companyName}</span>
      )}
      <span
        className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 font-medium ${
          dark ? "border-teal-700 bg-teal-900 text-teal-100" : "border-teal-200 bg-teal-50 text-teal-700"
        }`}
      >
        {roleName}
      </span>
    </span>
  );
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useAppShell() {
  return useContext(ShellContext);
}

// Shown on every page while Figbloom staff view a customer fleet read-only:
// whose fleet, that nothing can be changed, and the way back.
export const SUPPORT_BANNER_HEIGHT = "2.5rem";
function SupportBanner({ companyName, onExit }: { companyName: string; onExit: () => void }) {
  return (
    <div
      role="status"
      style={{ height: SUPPORT_BANNER_HEIGHT }}
      className="fixed inset-x-0 top-0 z-[60] flex items-center gap-2 bg-amber-400 px-3 text-xs font-medium text-amber-950 shadow print:hidden sm:gap-3 sm:px-4 sm:text-sm"
    >
      <FiEye className="shrink-0" size={16} />
      <span className="min-w-0 flex-1 truncate">
        Viewing <strong>{companyName}</strong> as Figbloom staff — read only
      </span>
      <button
        onClick={onExit}
        className="min-h-8 shrink-0 rounded-full bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-black"
      >
        Exit
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

// Short names for the phone tab bar, where a long label doesn't fit.
const TAB_LABELS: Record<string, string> = {
  "Customer fleets": "Fleets",
  "Fleet reports": "Reports",
  "Staff home": "Home",
};

export default function AppShell({ children, portal }: { children: ReactNode; portal: "admin" | "company" | "platform" }) {
  const pathname = usePathname();
  const { user, logout, exitSupportView } = useAuth();
  const { access } = useAdminAccess();
  const isOwner = user?.role === "COMPANY_OWNER";
  const isPlatform = portal === "platform";
  const support = user?.support ?? null;
  const supportView = !!support;

  const hr = useHrStatus();
  const role = user?.role ?? null;
  const manageTeam = canManageTeam(user);
  const nav = useMemo(
    () =>
      isPlatform
        ? platformNav()
        : fleetNav(`/${portal}` as "/admin" | "/company", {
            isOwner,
            canEditCompany: access === "full",
            supportView,
            role,
            canManageTeam: manageTeam,
            showHr: hr.canOpenHr,
            showMyHr: hr.hasMyHr,
          }),
    [isPlatform, portal, isOwner, access, supportView, role, manageTeam, hr.canOpenHr, hr.hasMyHr]
  );
  // The item just tapped lights up straight away, before its page has
  // loaded; it is only kept while the address is still the one it was
  // tapped on.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const pendingItem = pending && pending.from === pathname ? nav.items.find((i) => i.href === pending.href) : undefined;
  const isMap = !!nav.mapHref && pathname === nav.mapHref;
  const activeItem = pendingItem ?? activeNavItem(nav, pathname);
  const navigateTo = (e: MouseEvent, href: string) => {
    // a ctrl/cmd/shift-click opens another tab: nothing changes here
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (href !== pathname) setPending({ href, from: pathname });
  };

  const { companyName, companyLogoUrl, alertCount, toasts, dismissToast, unreadMessages, zoneCounts } = useShellData({
    alerts: !!nav.alertsHref,
    messages: !isPlatform && nav.items.some((i) => i.label === "Messages"),
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
  // Which kind of account this is: staff see that they are in the Figbloom
  // staff account (every customer fleet), and in a support view that they
  // are staff looking at one fleet read-only.
  const roleName = supportView
    ? "Figbloom staff · read-only support view"
    : isPlatform
      ? "Figbloom staff account"
      : roleLabel(user?.role, user?.adminAccess);
  const headerCompany = isPlatform ? "All customer fleets" : (companyName ?? support?.companyName ?? null);
  const banner = support && <SupportBanner companyName={companyName || support.companyName} onExit={exitSupportView} />;
  const bannerPad = support ? { paddingTop: SUPPORT_BANNER_HEIGHT } : undefined;
  const shellValue = useMemo(
    () => ({ nav, alertCount, unreadMessages, companyName, roleName }),
    [nav, alertCount, unreadMessages, companyName, roleName]
  );

  // Phone drawer: tied to the page it was opened on, so it closes on
  // navigation.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen = drawerPath === pathname;
  const setDrawerOpen = (open: boolean) => setDrawerPath(open ? pathname : null);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerPath(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const title = header?.title ?? activeItem?.label ?? "";
  const statsAtBottom = header?.position === "bottom";
  const pageStats = header?.stats && (
    <div className={`print:hidden ${statsAtBottom ? "mt-6" : "mb-6"}`}>{header.stats}</div>
  );

  function badgeFor(item: FleetNavItem) {
    if (item.badge === "alerts") return <CountBadge count={alertCount} tone="red" />;
    if (item.badge === "messages") return <CountBadge count={unreadMessages} tone="orange" />;
    return null;
  }

  const tabItems = nav.tabs.map((href) => nav.items.find((i) => i.href === href)).filter(Boolean) as FleetNavItem[];

  return (
    <ShellContext.Provider value={shellValue}>
      <PageHeaderContext.Provider value={headerContextValue}>
        <div className="flex h-dvh overflow-hidden bg-[#f5f6f8] print:block print:h-auto print:overflow-visible" style={bannerPad}>
          <div className="print:hidden">
            {nav.alertsHref && <AlertToastStack toasts={toasts} onDismiss={dismissToast} liveMapHref={nav.mapHref} />}
            <SessionExpiredModal />
            {/* Not over the drawer, and not on the phone map where the
                vehicle list sits along the bottom. */}
            {!isPlatform && !supportView && access !== "viewer" && (
              <AgentChatWidget hidden={drawerOpen} hideOnPhone={isMap} />
            )}
          </div>
          {banner}

          {drawerOpen && (
            <div className="fixed inset-0 z-40 bg-black/40 lg:hidden print:hidden" onClick={() => setDrawerOpen(false)} />
          )}

          {/* MENU: every page of this area, in one list. */}
          <aside
            aria-label="Main menu"
            id="main-menu"
            className={`fixed bottom-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col bg-teal-950 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-white transition-transform print:hidden lg:static lg:z-auto lg:w-60 lg:translate-x-0 lg:pb-0 lg:pl-0 ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            // below the support banner when it opens over the page on phones
            style={{ top: support ? SUPPORT_BANNER_HEIGHT : 0 }}
          >
            <div className="flex items-center gap-2 border-b border-teal-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-3">
              <BrandIcon variant="light" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold tracking-wide">FIGBLOOM FLEET</span>
                {(isPlatform || supportView) && (
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    {supportView ? "Figbloom staff · read only" : "Figbloom staff"}
                  </span>
                )}
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="-mr-1.5 flex h-10 w-10 items-center justify-center rounded-full text-teal-100 hover:bg-teal-900 hover:text-white lg:hidden"
              >
                <FiX size={18} />
              </button>
            </div>
            {/* On phones the header only has room for the page title and the
                fleet switcher, so the fleet and role are spelled out here. */}
            <div className="border-b border-teal-900 px-4 py-2.5 sm:hidden">
              <SignedInAs companyName={headerCompany} roleName={roleName} compact tone="dark" />
            </div>

            <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
              {nav.items.map((item) => {
                const Icon = item.icon;
                const active = item === activeItem;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => navigateTo(e, item.href)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded px-3 py-2 text-[13px] font-medium transition-colors lg:min-h-0 lg:text-xs ${
                      active ? "bg-teal-800 text-white" : "text-teal-50 hover:bg-teal-900"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badgeFor(item)}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-3 border-t border-teal-900 px-3 py-3">
              <Link
                href="/help"
                className="flex min-h-10 items-center gap-3 rounded px-3 py-2 text-xs font-medium text-teal-50 transition-colors hover:bg-teal-900"
              >
                <FiHelpCircle size={16} className="shrink-0" />
                <span className="flex-1">Help &amp; getting started</span>
              </Link>
              {companyName && (
                <div className="flex items-center gap-2 px-1">
                  <Avatar src={companyLogoUrl} name={companyName} size="sm" shape="square" />
                  <p className="min-w-0 truncate text-[11px] font-medium text-teal-50">{companyName}</p>
                </div>
              )}
              {access !== "full" && !supportView && (
                <span
                  className="inline-block rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-200"
                  title={
                    access === "viewer"
                      ? "You can see everything but can't make changes"
                      : "You can manage jobs, routes, messages and alerts"
                  }
                >
                  {access === "viewer" ? "View-only access" : "Dispatcher access"}
                </span>
              )}
              <div className="flex items-center gap-2 rounded-lg bg-teal-900/60 p-2">
                {me && <Avatar src={me.avatarUrl} name={me.fullName} size="sm" />}
                <div className="min-w-0 flex-1">
                  {me && <p className="truncate text-[11px] font-medium text-white">{me.fullName}</p>}
                  {/* Platform staff have no company to store an image under */}
                  {me && !isPlatform && !supportView && (
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
                <button
                  onClick={() => logout()}
                  title="Log out"
                  aria-label="Log out"
                  className="flex min-h-10 shrink-0 items-center gap-1 rounded px-2 py-1.5 text-[11px] font-medium text-teal-100 hover:bg-teal-800 hover:text-white lg:min-h-0"
                >
                  <FiLogOut size={14} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </aside>

          {/* PAGE */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
            <header className="flex shrink-0 items-center gap-1.5 border-b border-gray-200 bg-white py-1.5 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] print:hidden sm:gap-3 md:px-6 lg:py-3">
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                aria-controls="main-menu"
                aria-expanded={drawerOpen}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
              >
                <FiMenu size={20} />
              </button>
              <div className="min-w-0 flex-1">
                {/* Wraps onto a second line on narrow screens instead of
                    being cut to a couple of letters. */}
                <h1 className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-blue-950 lg:truncate lg:text-base">
                  {title}
                </h1>
                {header?.subtitle && <p className="hidden truncate text-xs text-gray-500 sm:block">{header.subtitle}</p>}
              </div>
              <span className="flex min-w-0 shrink-0 items-center gap-2">
                <span className="hidden min-w-0 sm:inline-flex">
                  <SignedInAs companyName={headerCompany} roleName={roleName} />
                </span>
                {/* the fleets this person is in, and "Create a new fleet" */}
                <FleetSwitcher />
              </span>
              {zoneCounts && (
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-600">
                    <FaMapMarkerAlt size={11} />
                    {zoneCounts.inZone} in zone
                  </span>
                  {/* Red only when something is actually outside its zone */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                      zoneCounts.outOfZone > 0
                        ? "border-red-200 bg-red-50 text-red-600"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    <FaLocationPinLock size={11} />
                    {zoneCounts.outOfZone} out of zone
                  </span>
                </div>
              )}
              {nav.alertsHref && (
                <Link
                  href={nav.alertsHref}
                  aria-label="Alerts"
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <FiBell size={19} />
                  <span className="absolute right-0 top-0">
                    <CountBadge count={alertCount} tone="red" />
                  </span>
                </Link>
              )}
            </header>

            <InShellContext.Provider value={true}>
              {isMap ? (
                <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
              ) : (
                <main className="app-content min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 print:overflow-visible print:bg-white print:p-0">
                  {!statsAtBottom && pageStats}
                  {children}
                  {statsAtBottom && pageStats}
                </main>
              )}
            </InShellContext.Provider>

            {/* PHONE TAB BAR: the most used pages, plus the full menu. */}
            <nav
              aria-label="Quick links"
              className="flex shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] print:hidden lg:hidden"
            >
              {tabItems.map((item) => {
                const Icon = item.icon;
                const active = item === activeItem;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => navigateTo(e, item.href)}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium ${
                      active ? "text-teal-700" : "text-gray-500"
                    }`}
                  >
                    <Icon size={18} />
                    {TAB_LABELS[item.label] ?? item.label}
                    {item.badge && <span className="absolute right-[22%] top-1">{badgeFor(item)}</span>}
                  </Link>
                );
              })}
              <button
                onClick={() => setDrawerOpen(true)}
                aria-controls="main-menu"
                aria-expanded={drawerOpen}
                className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-gray-500"
              >
                <FiMenu size={18} />
                Menu
              </button>
            </nav>
          </div>
        </div>
      </PageHeaderContext.Provider>
    </ShellContext.Provider>
  );
}
