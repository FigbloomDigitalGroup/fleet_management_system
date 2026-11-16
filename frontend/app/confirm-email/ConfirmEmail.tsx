"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { API_URL } from "../lib/api";
import CenteredCard from "../components/CenteredCard";

type State = { kind: "working" } | { kind: "done"; email: string } | { kind: "failed"; message: string };

const LINK = "mt-5 block rounded bg-orange-500 py-2.5 text-center text-sm font-medium text-white hover:bg-orange-600";

// The "Confirm your email" link from the welcome email after signing up
// (POST /api/auth/confirm-email). Works signed in or not.
export default function ConfirmEmail() {
  const query = useSearchParams();
  const [state, setState] = useState<State>({ kind: "working" });
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const token = query.get("token");
    const confirm = token
      ? fetch(`${API_URL}/api/auth/confirm-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "We couldn't confirm your email. Please try again.");
          return data as { email: string };
        })
      : Promise.reject(new Error("This link is missing its code. Open it again from the email."));
    confirm
      .then((data) => setState({ kind: "done", email: data.email }))
      .catch((err) =>
        setState({ kind: "failed", message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "We couldn't reach FIGBLOOM FLEET. Check your connection and try again." })
      );
  }, [query]);

  if (state.kind === "working") {
    return (
      <CenteredCard title="Confirming your email…">
        <p className="text-sm text-gray-500">One moment.</p>
      </CenteredCard>
    );
  }
  if (state.kind === "failed") {
    return (
      <CenteredCard title="We couldn't confirm your email">
        <p role="alert" className="text-sm text-gray-700">
          {state.message}
        </p>
        <Link href="/login" className={LINK}>
          Go to sign in
        </Link>
      </CenteredCard>
    );
  }
  return (
    <CenteredCard title="Your email is confirmed">
      <p className="text-sm text-gray-700">
        Thanks. <strong>{state.email}</strong> is confirmed, so if you ever forget your password, &quot;Forgot password&quot; on the Figbloom sign-in page
        can send you a code.
      </p>
      <Link href="/login" className={LINK}>
        Go to sign in
      </Link>
    </CenteredCard>
  );
}
