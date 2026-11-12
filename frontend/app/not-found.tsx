"use client";

import Link from "next/link";
import { useAuth } from "./context/AuthContext";
import { redirectPathForRole } from "./lib/roleRedirect";
import BrandIcon from "./components/BrandIcon";
import { SUPPORT_EMAIL } from "./lib/support";

// Any address that doesn't exist: say so in the product's own look, and
// offer the way back (your dashboard when signed in, otherwise the home and
// sign-in pages).
export default function NotFound() {
  const { user } = useAuth();
  const home = user ? redirectPathForRole(user.role) : "/";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f5f6f8] px-6 py-16 text-center">
      <Link href="/" className="mb-10 flex items-center gap-2 text-lg font-bold text-teal-950">
        <BrandIcon variant="dark" className="h-6 w-6" />
        FIGBLOOM FLEET
      </Link>
      <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">Page not found</p>
      <h1 className="mt-2 text-3xl font-extrabold text-teal-950 sm:text-4xl">This page took a wrong turn</h1>
      <p className="mt-3 max-w-md text-sm text-gray-600">
        The address may be mistyped, or the page has moved. Nothing is wrong with your fleet.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href={home} className="rounded bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600">
          {user ? "Go to your dashboard" : "Go to the home page"}
        </Link>
        {!user && (
          <Link href="/login" className="rounded border border-teal-600 px-5 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50">
            Sign in
          </Link>
        )}
        <Link href="/help" className="px-3 py-2.5 text-sm font-medium text-teal-700 hover:underline">
          Help
        </Link>
      </div>
      <p className="mt-10 text-xs text-gray-500">
        Followed a link from us? Tell us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal-700 hover:underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </main>
  );
}
