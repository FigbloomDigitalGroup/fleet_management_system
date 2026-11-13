"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import CenteredCard from "../components/CenteredCard";
import CreateFleetForm from "../components/CreateFleetForm";
import FullPageLoading from "../components/FullPageLoading";

// A new fleet for someone who already has an account: where Register sends
// an email that's already in use (sign in first, then this), with the fleet
// name and industry they typed carried over in the link.
export default function NewFleetPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  // what Register carried over (read once; the page only renders in the browser after sign-in is known)
  const [prefill] = useState<{ name?: string; industry?: string }>(() => {
    if (typeof window === "undefined") return {};
    const q = new URLSearchParams(window.location.search);
    return { name: q.get("name") ?? undefined, industry: q.get("industry") ?? undefined };
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
    }
  }, [user, loading, router]);

  if (loading || !user) return <FullPageLoading />;
  const back = () => router.push(redirectPathForRole(user.role));

  return (
    <CenteredCard title="Add a new fleet to your account">
      <CreateFleetForm initialName={prefill.name} initialIndustry={prefill.industry} onCancel={back} onDone={back} />
    </CenteredCard>
  );
}
