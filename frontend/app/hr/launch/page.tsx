"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconType } from "react-icons";
import { FiAlertCircle, FiClock, FiLock, FiSettings, FiShield, FiWifiOff } from "react-icons/fi";
import { apiRequest, type ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { HR_LAUNCH_PATH, hrAreaFor } from "../../lib/hrLaunch";
import BrandIcon from "../../components/BrandIcon";

// The new tab Figbloom HR opens in (opened by the HR & Payroll menu item and
// card). It asks Fleet for a one-time sign-in link (POST /api/hr/handoff,
// signed in the same way as the rest of the app: this tab shares the
// session) and replaces itself with it. If that fails, it says why in plain
// words. The link holds a one-time code: never shown or logged.

type Problem = "not_enabled" | "setting_up" | "forbidden" | "session" | "rate_limited" | "unreachable";

const STILL_WORKING_MS = 8_000;

function problemOf(err: unknown): Problem {
  const e = err as ApiError;
  const code = typeof e?.data?.code === "string" ? e.data.code : null;
  if (code === "hr_not_enabled_for_company" || code === "target_not_enabled") return "not_enabled";
  if (code === "hr_setting_up" || code === "target_not_linked") return "setting_up";
  if (code === "rate_limited" || e?.status === 429) return "rate_limited";
  if (code === "role_forbidden" || e?.status === 403) return "forbidden";
  // a 401 that a token refresh couldn't fix signs the session out (lib/api.ts)
  if (e?.status === 401 || !localStorage.getItem("accessToken")) return "session";
  return "unreachable";
}

const PROBLEMS: Record<Problem, { icon: IconType; title: string; message: string }> = {
  not_enabled: {
    icon: FiSettings,
    title: "Figbloom HR isn't set up for your company yet",
    message: "Ask Figbloom to switch on HR & Payroll for your company, and we'll get in touch to set it up.",
  },
  setting_up: {
    icon: FiClock,
    title: "Figbloom HR is still being set up",
    message: "Figbloom HR is switched on for your company and is being prepared. The owner will receive an email invitation once it's ready.",
  },
  forbidden: {
    icon: FiShield,
    title: "Only owners and admins can open HR & Payroll",
    message: "Ask your fleet owner or a full admin if you need access to HR & Payroll.",
  },
  session: {
    icon: FiLock,
    title: "Your session has ended",
    message: "Sign in to Figbloom Fleet again, then open HR & Payroll.",
  },
  rate_limited: {
    icon: FiClock,
    title: "Too many attempts",
    message: "Wait a minute and try again.",
  },
  unreachable: {
    icon: FiWifiOff,
    title: "We couldn't reach Figbloom HR",
    message: "Figbloom HR didn't answer. Check your connection and try again in a minute.",
  },
};

function isHttps(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export default function HrLaunchPage() {
  const { user, loading } = useAuth();
  const signedOut = !loading && (!user || !user.companyId);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ attempt: number; problem: Problem } | null>(null);
  const [slowAttempt, setSlowAttempt] = useState<number | null>(null);
  const [cantClose, setCantClose] = useState(false);
  const started = useRef(-1);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (loading || signedOut || started.current === attempt) return;
    // once per attempt (React runs effects twice in development)
    started.current = attempt;
    const slow = window.setTimeout(() => setSlowAttempt(attempt), STILL_WORKING_MS);
    apiRequest<{ url?: string }>("/api/hr/handoff", { method: "POST", body: JSON.stringify({}), successMessage: false, silent: true })
      .then(({ url }) => {
        if (!isHttps(url)) throw new Error("not an https link");
        window.location.replace(url);
      })
      .catch((err) => {
        window.clearTimeout(slow);
        setFailure({ attempt, problem: problemOf(err) });
      });
  }, [loading, signedOut, attempt]);

  const problem: Problem | null = signedOut ? "session" : failure?.attempt === attempt ? failure.problem : null;

  useEffect(() => {
    if (problem) titleRef.current?.focus();
  }, [problem]);

  const area = hrAreaFor(user?.role);

  function closeTab() {
    window.close();
    // only a tab opened by a script can close itself
    window.setTimeout(() => {
      if (!window.closed) setCantClose(true);
    }, 300);
  }

  const shown = problem ? PROBLEMS[problem] : null;
  const Icon = shown?.icon ?? FiAlertCircle;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 py-10 text-gray-900">
      <span className="mb-6 flex items-center gap-2 text-lg font-bold text-teal-900">
        <BrandIcon variant="dark" className="h-6 w-6" />
        FIGBLOOM FLEET
      </span>
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        {!shown ? (
          <div role="status" aria-live="polite">
            <span
              aria-hidden
              className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600"
            />
            <h1 className="mt-6 text-lg font-semibold">Connecting you to Figbloom HR</h1>
            <p className="mt-2 text-sm text-gray-600">Signing you in securely. This takes a moment.</p>
            {slowAttempt === attempt && <p className="mt-3 text-sm text-gray-500">Still working…</p>}
          </div>
        ) : (
          <div role="alert">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <Icon size={22} aria-hidden />
            </span>
            <h1 ref={titleRef} tabIndex={-1} className="mt-5 text-lg font-semibold outline-none">
              {shown.title}
            </h1>
            <p className="mt-2 text-sm text-gray-600">{shown.message}</p>
            <div className="mt-6 flex flex-col gap-2">
              {problem === "session" ? (
                <Link
                  href={`/login?next=${encodeURIComponent(HR_LAUNCH_PATH)}`}
                  className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Sign in
                </Link>
              ) : (
                <>
                  {problem === "not_enabled" && (
                    <Link href={`${area}/hr`} className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
                      Request Figbloom HR
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className={
                      problem === "not_enabled"
                        ? "rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        : "rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    }
                  >
                    Try again
                  </button>
                </>
              )}
              {cantClose ? (
                <Link href={`${area}/dashboard`} className="px-4 py-2 text-sm font-medium text-teal-700 hover:underline">
                  Back to Figbloom Fleet
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={closeTab}
                  className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close tab
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
