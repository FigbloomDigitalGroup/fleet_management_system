"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Role } from "../types/auth";
import FullPageLoading from "./FullPageLoading";

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

  // While checking auth state, or redirecting, show the loader rather than
  // any protected content — the same one pages show while their data loads,
  // so the two read as one continuous loading screen.
  if (loading || !user || !allowedRoles.includes(user.role)) {
    return <FullPageLoading />;
  }

  return <>{children}</>;
}














