"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { IconType } from "react-icons";
import { FiBell } from "react-icons/fi";
import { FaCog } from "react-icons/fa";

interface NavItem {
  label: string;
  href: string;
  icon: IconType;
}

interface PageHeaderValue {
  title: string;
  subtitle?: string;
}

interface PageHeaderContextType {
  header: PageHeaderValue | null;
  setHeader: (header: PageHeaderValue | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | null>(null);

// Lets any page pinned inside DashboardShell put its title/subtitle in the
// floating header instead of scrolling away with the rest of the page.
export function usePageHeader(title: string, subtitle?: string) {
  const ctx = useContext(PageHeaderContext);
  const setHeader = ctx?.setHeader;

  useEffect(() => {
    setHeader?.({ title, subtitle });
    return () => setHeader?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeader, title, subtitle]);
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
  const { logout } = useAuth();
  const alertsHref = navItems.find((item) => item.label === "Alerts")?.href;
  const [header, setHeader] = useState<PageHeaderValue | null>(null);
  const headerContextValue = useMemo(() => ({ header, setHeader }), [header]);

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex">
      {/* SIDEBAR */}
      <aside className="h-screen w-60 shrink-0 overflow-y-auto bg-blue-950 border-r border-blue-950 flex flex-col text-white">
        <div className="px-5 py-5 border-b border-blue-950">
          <span className="flex items-center gap-2 text-lg font-bold text-white">
            <FaCog aria-hidden="true" />
            DETOUR
          </span>
          <p className="text-xs text-white mt-0.5">{title}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${active
                  ? "bg-blue-900 text-white"
                  : "text-white hover:bg-blue-900"
                  }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* MAIN CONTENT */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* FLOATING HEADER — holds the current page's title, pinned above the scroll */}
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between bg-blue-950 px-8 py-4">
          <div>
            {header && <h1 className="text-lg font-bold text-white">{header.title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            {alertsHref && (
              <Link
                href={alertsHref}
                aria-label="Alerts"
                className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
              >
                <FiBell size={20} />
              </Link>
            )}
            <button
              onClick={logout}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-8">
          <PageHeaderContext.Provider value={headerContextValue}>{children}</PageHeaderContext.Provider>
        </main>
      </div>
    </div>
  );
}