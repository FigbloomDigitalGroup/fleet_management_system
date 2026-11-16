"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import AuthHeroPanel from "../components/AuthHeroPanel";
import RobotCheckbox from "../components/RobotCheckbox";
import BrandIcon from "../components/BrandIcon";
import PasswordInput from "../components/PasswordInput";
import DriverAppBadge from "../components/DriverAppBadge";
import AccountStatus, { AccountStatusInfo, isAccountStatusCode } from "../components/AccountStatus";
import { ApiError } from "../lib/api";
import { landAfterSignIn } from "../lib/signInLanding";
import { FigbloomPool, figbloomSignInEnabled, startFigbloomSignIn } from "../lib/figbloomSignIn";

const STEPS = [
  { n: 1, title: "Register your fleet", text: "Create your account in minutes, as a business or just for your own vehicles." },
  { n: 2, title: "Add vehicles & drivers", text: "Register each vehicle, assign a driver, and set up alerts or zones." },
  { n: 3, title: "Track live, get alerted", text: "Watch your fleet move in real time, and get notified the moment something needs attention." },
];

// After a session timeout (or a link opened while signed out) the sign-in
// page carries ?next=<page>.
function nextParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("next");
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHuman, setIsHuman] = useState(false);
  // A refused sign-in, shown under the form rather than as a popup.
  const [formError, setFormError] = useState<string | null>(null);
  // A pending / suspended fleet: a status screen instead of the form.
  const [status, setStatus] = useState<AccountStatusInfo | null>(null);

  async function signIn() {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const user = await login(email, password);
      // The account decides where it lands; the welcome says which area.
      router.push(landAfterSignIn(user, nextParam()));
    } catch (err) {
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
      } else if (!e.notified) {
        setFormError(e.message || "We couldn't sign you in. Check your details and try again.");
      }
      setIsSubmitting(false);
    }
  }

  // Figbloom sign-in: off to Figbloom's sign-in page, back at /auth/callback.
  async function signInWithFigbloom(pool: FigbloomPool) {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await startFigbloomSignIn(pool, nextParam());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Figbloom sign-in isn't available right now.");
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    signIn();
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* LEFT — Hero panel */}
      <AuthHeroPanel className="lg:w-1/2 flex flex-col justify-between p-10 lg:p-16">
        {/* content sits above the panel's dark overlay */}
        <div className="relative z-20 flex flex-col justify-between h-full">
          <span className="flex items-center gap-2 text-xl font-bold text-white">
            <BrandIcon variant="light" className="h-6 w-6" />
            FIGBLOOM FLEET
          </span>

          <div className="flex-1 flex flex-col justify-center py-16">
            <span className="text-xs uppercase tracking-wide text-teal-300 font-bold mb-5 block">How it works</span>
            <div className="space-y-5">
              {STEPS.map((step) => (
                <div key={step.n} className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                    {step.n}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{step.title}</h3>
                    <p className="text-gray-300 text-xs mt-1">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Every vehicle,
              <br />
              accounted for.
            </h1>
            <p className="text-gray-200 max-w-xs">
              Live tracking, trip history, and fleet analytics in one place for owners, admins and drivers alike.
            </p>

            <div className="mt-5">
              <p className="text-xs text-gray-300 mb-2">The driver app</p>
              <DriverAppBadge />
            </div>
          </div>
        </div>
      </AuthHeroPanel>

      {/* RIGHT — Form panel, or the fleet's status */}
      <div className="lg:w-1/2 flex items-center justify-center p-8">
        {status ? (
          <AccountStatus
            info={status}
            email={email}
            retrying={isSubmitting}
            onRetry={signIn}
            onBack={() => {
              setStatus(null);
              setPassword("");
            }}
          />
        ) : (
          <div className="w-full max-w-sm">
            <h2 className="text-5xl font-extrabold text-teal-950 mb-2">Sign in</h2>
            <p className="text-sm text-gray-500 mb-8">
              Company owners, fleet admins and Figbloom staff all sign in here; your account decides where you land. Drivers
              use the mobile app.
            </p>

            {figbloomSignInEnabled() ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => signInWithFigbloom("customers")}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                >
                  {isSubmitting ? "Opening Figbloom sign-in…" : "Sign in with Figbloom"}
                </button>
                <p className="text-xs text-gray-500">
                  You sign in on Figbloom&apos;s sign-in page with your email and password: one account for every Figbloom product.
                  Forgotten your password? Use &quot;Forgot password&quot; there.
                </p>
                {formError && (
                  <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Figbloom staff?{" "}
                  <button type="button" onClick={() => signInWithFigbloom("staff")} disabled={isSubmitting} className="text-teal-600 font-medium hover:underline">
                    Staff sign-in
                  </button>
                </p>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Your email"
                  className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <a href="/forgot-password" className="text-xs text-teal-600 font-medium hover:underline">
                    Forgot password?
                  </a>
                </div>
                <PasswordInput
                  id="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Your password"
                  className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <RobotCheckbox checked={isHuman} onChange={setIsHuman} />

              {formError && (
                <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting || !isHuman}
                  aria-describedby={!isHuman ? "signin-robot-hint" : undefined}
                  className="w-full py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                >
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
                {!isHuman && (
                  <p id="signin-robot-hint" className="mt-1.5 text-center text-xs text-gray-500">
                    Tick &quot;I&apos;m not a robot&quot; above to continue.
                  </p>
                )}
              </div>
            </form>
            )}

            <p className="text-sm text-gray-500 mt-8">
              Registering a new company?{" "}
              <a href="/register" className="text-teal-500 font-medium hover:underline">
                Set up your account
              </a>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Not sure where to start?{" "}
              <a href="/help" className="text-teal-500 font-medium hover:underline">
                How FIGBLOOM FLEET works
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
