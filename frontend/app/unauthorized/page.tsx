"use client";

import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--ink)" }}>
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl mb-3" style={{ color: "var(--paper)" }}>
          Not your workspace
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--fog)" }}>
          This page isn't available for your account. Head back to your own dashboard instead.
        </p>
        <button
          onClick={() => (user ? router.push(redirectPathForRole(user.role)) : router.push("/login"))}
          className="px-5 py-2.5 rounded-md text-sm font-medium mr-3"
          style={{ background: "var(--signal)", color: "var(--ink)" }}
        >
          Go to my dashboard
        </button>
        <button
          onClick={logout}
          className="px-5 py-2.5 rounded-md text-sm"
          style={{ border: "1px solid var(--line)", color: "var(--fog)" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}