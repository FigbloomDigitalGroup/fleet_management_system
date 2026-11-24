"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import localFont from "next/font/local";
import { apiRequest, type ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { HR_LAUNCH_PATH, hrAreaFor } from "../../lib/hrLaunch";
import styles from "./launch.module.css";

// Outfit, as Figbloom HR uses: self-hosted (app/fonts, SIL OFL) so the build
// never fetches Google Fonts.
const outfit = localFont({
  src: "../../fonts/outfit-latin-300-normal.woff2",
  weight: "300",
  style: "normal",
  display: "swap",
  variable: "--fb-outfit",
});

// The new tab Figbloom HR opens in (opened by the HR & Payroll menu item and
// card). It asks Fleet for a one-time sign-in link (POST /api/hr/handoff,
// signed in the same way as the rest of the app: this tab shares the
// session) and replaces itself with it. If that fails, it says why in plain
// words. The link holds a one-time code: never shown or logged.
//
// It looks exactly like Figbloom HR's own "Opening Figbloom HR" screen (its
// /handoff page and boot screen), so going from Fleet to HR is one screen.

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

const PROBLEMS: Record<Problem, { title: string; message: string }> = {
  not_enabled: {
    title: "Figbloom HR isn't set up for your company yet",
    message: "Ask Figbloom to switch on HR & Payroll for your company, and we'll get in touch to set it up.",
  },
  setting_up: {
    title: "Figbloom HR is still being set up",
    message: "Figbloom HR is switched on for your company and is being prepared. The owner will receive an email invitation once it's ready.",
  },
  forbidden: {
    title: "Only owners and admins can open HR & Payroll",
    message: "Ask your fleet owner or a full admin if you need access to HR & Payroll.",
  },
  session: {
    title: "Your session has ended",
    message: "Sign in to Figbloom Fleet again, then open HR & Payroll.",
  },
  rate_limited: {
    title: "Too many attempts",
    message: "Wait a minute and try again.",
  },
  unreachable: {
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

  return (
    <div className={`${outfit.variable} ${styles.screen}`}>
      {!shown ? (
        <div className={`${styles.loader} ${styles.animated}`} role="status" aria-live="polite" aria-label="Opening Figbloom HR">
          <FigbloomMark size={120} />
          <div className={styles.label}>
            <div>
              Opening Figbloom HR
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
            </div>
            {slowAttempt === attempt && <div className={styles.still}>Still working…</div>}
          </div>
        </div>
      ) : (
        <div className={styles.error} role="alert">
          <FigbloomMark size={64} />
          <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
            {shown.title}
          </h1>
          <p className={styles.message}>{shown.message}</p>
          <div className={styles.actions}>
            {problem === "session" ? (
              <Link href={`/login?next=${encodeURIComponent(HR_LAUNCH_PATH)}`} className={styles.primary}>
                Sign in
              </Link>
            ) : (
              <>
                {problem === "not_enabled" && (
                  <Link href={`${area}/hr`} className={styles.primary}>
                    Request Figbloom HR
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setAttempt((n) => n + 1)}
                  className={problem === "not_enabled" ? styles.secondary : styles.primary}
                >
                  Try again
                </button>
              </>
            )}
            {cantClose ? (
              <Link href={`${area}/dashboard`} className={styles.link}>
                Back to Figbloom Fleet
              </Link>
            ) : (
              <button type="button" onClick={closeTab} className={styles.secondary}>
                Close tab
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// The Figbloom HR orbit logo (bloomHR FigbloomLoader). It moves only inside
// .animated (the loading screen); the error state shows it still.
function FigbloomMark({ size }: { size: number }) {
  return (
    <svg className={styles.logo} viewBox="8 5 48 48" aria-hidden="true" width={size} height={size}>
      <circle className={styles.arc} cx="32" cy="29" r="19" pathLength="360" fill="none" strokeWidth="5.5" strokeLinecap="round" />
      <circle className={styles.bowl} cx="32" cy="29" r="9" fill="none" strokeWidth="6.5" />
      <path className={styles.leaf} d="M33 14.5 C33 8.5 38 5.5 43 5.5 C43 11.5 39 14.5 33 14.5 Z" />
    </svg>
  );
}
