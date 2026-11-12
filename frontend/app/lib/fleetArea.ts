import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useAdminAccess } from "./adminAccess";
import { EmptyStateAction } from "../components/EmptyState";

// Which company-side area a shared component is showing in, and what the
// signed-in person can do there, for empty states and the Getting started
// checklist. Company owners manage their own fleet exactly like a full fleet
// admin (the API allows both, always inside their own company); restricted
// admins (dispatcher / viewer) can't add vehicles or drivers.
export function useFleetArea() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { canManageFleet, canDispatch } = useAdminAccess();
  const base: "/company" | "/admin" = pathname?.startsWith("/company") ? "/company" : "/admin";
  const isOwner = user?.role === "COMPANY_OWNER";
  const canAddFleet = canManageFleet;

  // Where "add a vehicle/driver" leads for this person.
  function addFleetAction(kind: "vehicle" | "driver"): EmptyStateAction | null {
    if (!canAddFleet) return null;
    return kind === "vehicle"
      ? { label: "Add your first vehicle", href: "#add-vehicle" }
      : { label: "Add your first driver", href: "#add-driver" };
  }

  return { base, isOwner, canManageFleet, canDispatch, canAddFleet, addFleetAction };
}
