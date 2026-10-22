"use client";

import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-white">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Not your workspace</h1>
        <p className="text-sm text-gray-500 mb-8">
          This page isn't available for your account. Head back to your own dashboard instead.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => (user ? router.push(redirectPathForRole(user.role)) : router.push("/login"))}
            className="px-5 py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
          >
            Go to my dashboard
          </button>
          <button
            onClick={logout}
            className="px-5 py-2.5 rounded text-sm border border-gray-300 text-gray-600 hover:border-gray-400"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}