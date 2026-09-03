"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Role } from "../types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // wait until we've checked localStorage

    if (!user) {
      router.push("/login");
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      router.push("/unauthorized");
    }
  }, [user, loading, allowedRoles, router]);

  // While checking auth state, or redirecting, show nothing (avoids a flash of protected content)
  if (loading || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ink)" }}>
        <span className="font-mono text-xs" style={{ color: "var(--fog)" }}>
          checking access…
        </span>
      </div>
    );
  }

  return <>{children}</>;
}














