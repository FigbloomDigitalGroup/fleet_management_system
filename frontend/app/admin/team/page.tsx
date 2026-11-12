"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TeamManager from "../../components/TeamManager";
import { useAuth } from "../../context/AuthContext";
import { canManageTeam } from "../../lib/staffRoles";

// Team for full admins (the owner's is /company/admins).
export default function AdminTeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = canManageTeam(user);
  useEffect(() => {
    if (user && !allowed) router.replace("/admin/dashboard");
  }, [user, allowed, router]);
  return allowed ? <TeamManager /> : null;
}
