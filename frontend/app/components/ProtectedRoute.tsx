"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Role } from "../types/auth";
import FullPageLoading from "./FullPageLoading";
import { redirectPathForRole } from "../lib/roleRedirect";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, signedOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // wait until we've checked localStorage

    if (!user) {
      // Signing out navigates by itself. Otherwise (an old bookmark, a link
      // opened while signed out) come back here after signing in.
      if (!signedOut) router.push(`/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
      return;
    }

    // Someone signed in to a different role's area (an old bookmark, a
    // shared link) goes to their own dashboard rather than a dead end.
    if (!allowedRoles.includes(user.role)) {
      router.replace(redirectPathForRole(user.role));
    }
  }, [user, loading, signedOut, allowedRoles, router]);

  // While checking auth state, or redirecting, show the loader rather than
  // any protected content — the same one pages show while their data loads,
  // so the two read as one continuous loading screen.
  if (loading || !user || !allowedRoles.includes(user.role)) {
    return <FullPageLoading />;
  }

  return <>{children}</>;
}














