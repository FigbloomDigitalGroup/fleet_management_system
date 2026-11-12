"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ProtectedRoute from "../components/ProtectedRoute";
import AppShell from "../components/AppShell";
import FullPageLoading from "../components/FullPageLoading";
import { FleetThemeProvider } from "../context/FleetThemeContext";
import { useAuth } from "../context/AuthContext";
import { STAFF_ROLES, staffPageAllowed } from "../lib/staffRoles";
import { Role } from "../types/auth";

const ADMIN_AREA_ROLES: Role[] = ["ADMIN", ...STAFF_ROLES];

// A staff role opening a page outside its own (an old link, a shared URL)
// goes to the overview; the API would refuse that page's data anyway.
function StaffPageGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const allowed = staffPageAllowed(user?.role, pathname);
  useEffect(() => {
    if (!allowed) router.replace("/admin/dashboard");
  }, [allowed, router]);
  return allowed ? <>{children}</> : <FullPageLoading />;
}

// Navigation lives in lib/fleetNav.ts — the Live Map is home, everything
// else sits in the Reports / Dispatch / Settings sections. The company staff
// roles (operator, accountant, mechanic, supervisor) share this area, each
// with its own menu (lib/staffRoles.ts).
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={ADMIN_AREA_ROLES}>
      <FleetThemeProvider>
        <AppShell portal="admin">
          <StaffPageGuard>{children}</StaffPageGuard>
        </AppShell>
      </FleetThemeProvider>
    </ProtectedRoute>
  );
}
