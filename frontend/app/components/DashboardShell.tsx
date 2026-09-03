"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { IconType } from "react-icons";
import { FiLogOut } from "react-icons/fi";

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
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-200">
          <span className="text-lg font-bold text-gray-900">DETOUR</span>
          <p className="text-xs text-gray-500 mt-0.5">{title}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-green-50 text-green-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 px-3 mb-2 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 w-full"
          >
            <FiLogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}