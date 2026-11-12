import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useAdminAccess } from "./adminAccess";
import { EmptyStateAction } from "../components/EmptyState";

// Which company-side area a shared component is showing in, and what the
// signed-in person can do there, for empty states and the Getting started
// checklist. Vehicles and drivers are created by fleet admins (the API
// refuses them from company owners), so an owner's next step there is
// inviting an admin.
export function useFleetArea() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { canManageFleet, canDispatch } = useAdminAccess();
  const base: "/company" | "/admin" = pathname?.startsWith("/company") ? "/company" : "/admin";
  const isOwner = user?.role === "COMPANY_OWNER";
  // Owners can't add vehicles or drivers; admins can unless restricted.
  const canAddFleet = !isOwner && canManageFleet;

  // Where "add a vehicle/driver" leads for this person.
  function addFleetAction(kind: "vehicle" | "driver"): EmptyStateAction | null {
    if (canAddFleet) {
      return kind === "vehicle"
        ? { label: "Add your first vehicle", href: "#add-vehicle" }
        : { label: "Add your first driver", href: "#add-driver" };
    }
    if (isOwner) return { label: "Invite a fleet admin", href: "/company/admins#add-admin" };
    return null;
  }

  return { base, isOwner, canManageFleet, canDispatch, canAddFleet, addFleetAction };
}
