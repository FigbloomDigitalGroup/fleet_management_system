"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { FigbloomPool, readFigbloomReturn, startFigbloomSignIn } from "../lib/figbloomSignIn";
import { landAfterSignIn } from "../lib/signInLanding";
import CenteredCard from "../components/CenteredCard";
import AccountStatus, { AccountStatusInfo, isAccountStatusCode } from "../components/AccountStatus";

const BUTTON = "w-full rounded bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60";

// Figbloom's sign-in page sends the browser back here with a code
// (lib/figbloomSignIn.ts); the API swaps it for Fleet's session, and the
// person lands where Fleet's own sign-in would have taken them.
export default function FigbloomCallback({ pool }: { pool: FigbloomPool }) {
  const query = useSearchParams();
  const router = useRouter();
  const { completeFigbloomSignIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AccountStatusInfo | null>(null);
  const [retrying, setRetrying] = useState(false);
  // the code is single use: never sent twice (React runs effects twice in development)
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const back = readFigbloomReturn(pool, new URLSearchParams(query.toString()));
    const signIn = "error" in back ? Promise.reject(new Error(back.error)) : completeFigbloomSignIn(back);
    signIn
      .then((user) => router.replace(landAfterSignIn(user, "error" in back ? null : back.next)))
      .catch((err) => {
        const e = err as ApiError;
        const code = e.data?.code;
        if (isAccountStatusCode(code)) {
          setStatus({
            code,
            companyName: e.data?.companyName as string | undefined,
            registeredAt: e.data?.registeredAt as string | undefined,
            approval: e.data?.approval as AccountStatusInfo["approval"],
            supportEmail: e.data?.supportEmail as string | undefined,
          });
        } else {
          setError(e.message || "We couldn't sign you in. Please try again.");
        }
      });
  }, [pool, query, completeFigbloomSignIn, router]);

  function again() {
    setRetrying(true);
    startFigbloomSignIn(pool).catch((err) => {
      setError(err instanceof Error ? err.message : "Please try again.");
      setRetrying(false);
    });
  }

  if (status) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <AccountStatus info={status} email="" retrying={retrying} onRetry={again} onBack={() => router.push("/login")} />
      </div>
    );
  }

  if (error) {
    return (
      <CenteredCard title="Sign-in didn't finish">
        <p role="alert" className="text-sm text-gray-700">
          {error}
        </p>
        <button type="button" onClick={again} disabled={retrying} className={`${BUTTON} mt-5`}>
          {retrying ? "Opening Figbloom sign-in…" : "Try again"}
        </button>
        <Link href="/login" className="mt-3 block rounded border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
          Back to sign in
        </Link>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard title="Signing you in…">
      <p className="text-sm text-gray-500">One moment.</p>
    </CenteredCard>
  );
}
