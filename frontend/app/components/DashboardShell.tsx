"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { IconType } from "react-icons";
import { FiLogOut } from "react-icons/fi";
import { FaCog } from "react-icons/fa";

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

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside className="h-screen w-60 shrink-0 overflow-y-auto bg-blue-400 border-r border-blue-400 flex flex-col text-white">
        <div className="px-5 py-5 border-b border-blue-400">
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
                  ? "bg-blue-400 text-white"
                  : "text-white hover:bg-blue-400"
                  }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-blue-400">
          <p className="text-xs text-white px-3 mb-2 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-white hover:bg-blue-400 w-full"
          >
            <FiLogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="min-w-0 flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}