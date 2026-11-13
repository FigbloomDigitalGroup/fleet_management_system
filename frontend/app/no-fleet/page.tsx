"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import CenteredCard from "../components/CenteredCard";
import CreateFleetForm from "../components/CreateFleetForm";
import FullPageLoading from "../components/FullPageLoading";

// Signed in, but in no fleet any more (every membership switched off or
// removed): say so plainly, and offer the two ways forward.
export default function NoFleetPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role) router.replace(redirectPathForRole(user.role));
  }, [user, loading, router]);

  if (loading || !user || user.role) return <FullPageLoading />;

  return (
    <CenteredCard title="You're not part of any fleet right now">
      {creating ? (
        <CreateFleetForm onCancel={() => setCreating(false)} onDone={() => setCreating(false)} />
      ) : (
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            You&apos;re signed in as <strong>{user.email}</strong>, but no fleet has you as a member at the moment. This usually means the fleet
            owner switched your access off.
          </p>
          <p>If you should still have access, ask the fleet owner to switch you back on or to send you a new invitation by email.</p>
          <div className="flex flex-col gap-2 pt-2">
            <button type="button" onClick={() => setCreating(true)} className="rounded bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600">
              Start a fleet of my own
            </button>
            <button type="button" onClick={() => logout()} className="rounded border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Sign out
            </button>
          </div>
        </div>
      )}
    </CenteredCard>
  );
}
