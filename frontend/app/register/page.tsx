"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import AuthHeroPanel from "../components/AuthHeroPanel";
import RobotCheckbox from "../components/RobotCheckbox";
import BrandIcon from "../components/BrandIcon";
import PasswordInput from "../components/PasswordInput";
import DriverAppBadge from "../components/DriverAppBadge";
import { INDUSTRIES, INDUSTRIES_WITH_IMAGES } from "../lib/industries";
import { API_URL, ApiError } from "../lib/api";
import { LoginResponse } from "../types/auth";
import RegistrationDone, { Approval } from "./RegistrationDone";
import { defaultFleetName } from "../lib/fleetName";

const MIN_PASSWORD = 8;
const inputClass = (invalid: boolean) =>
  `w-full px-3.5 py-2.5 rounded text-sm border outline-none focus:ring-1 ${
    invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-teal-600 focus:ring-teal-600"
  }`;

type Field = "fullName" | "companyName" | "email" | "password";

export default function RegisterPage() {
  const { register, adoptSession, user, loading } = useAuth();
  const router = useRouter();

  // Already signed in: a new fleet is added to the account they have (no
  // second account, no password step). Checked once, when the page opens.
  useEffect(() => {
    if (!loading && user && !user.support) router.replace("/new-fleet");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const [companyName, setCompanyName] = useState("");
  // Once the owner edits the fleet name themselves, stop filling it in.
  const [fleetNameEdited, setFleetNameEdited] = useState(false);
  const [industry, setIndustry] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHuman, setIsHuman] = useState(false);
  // What's wrong, next to the field it's about (or above the button).
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // The email already has an account: sign in, then add this fleet to it.
  const [existingAccount, setExistingAccount] = useState<string | null>(null);
  // Set once the company is registered: "active" when it can be used right
  // away, "pending" while it waits for approval.
  const [done, setDone] = useState<{ email: string; status: "active" | "pending"; approval: Approval; supportEmail?: string } | null>(
    null
  );
  // A pending registration's tokens, kept in memory only (never stored), so
  // the page can notice the company being switched on and sign straight in.
  const pendingSession = useRef<LoginResponse | null>(null);

  // A fleet waiting on the Figbloom console is usually switched on a minute
  // or so after registering (the platform sync runs every minute). While the
  // owner is still on this page, check quietly every 15s for up to 10
  // minutes and flip to "you're in" when it happens. The email covers the
  // rest.
  useEffect(() => {
    if (done?.status !== "pending" || !pendingSession.current) return;
    const token = pendingSession.current.accessToken;
    const startedAt = Date.now();
    let cancelled = false;
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/companies/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const company = (await res.json()) as { status?: string };
        if (!cancelled && company.status === "active") {
          clearInterval(timer);
          setDone((d) => (d ? { ...d, status: "active" } : d));
        }
      } catch {
        // offline for a moment: try again on the next tick
      }
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [done?.status]);

  function openDashboard() {
    // Approved while waiting: start the session from the tokens in hand.
    if (pendingSession.current) adoptSession(pendingSession.current);
    router.push(redirectPathForRole("COMPANY_OWNER"));
  }

  function clearError(field: Field) {
    setFieldErrors((f) => ({ ...f, [field]: undefined }));
    setFormError(null);
    if (field === "email") setExistingAccount(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors: Partial<Record<Field, string>> = {};
    if (!fullName.trim()) errors.fullName = "Enter your name.";
    if (!companyName.trim()) errors.companyName = "Give your fleet a name (your own name is fine).";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter an email address like name@example.com.";
    if (password.length < MIN_PASSWORD) {
      errors.password = `Use at least ${MIN_PASSWORD} characters (you've typed ${password.length}).`;
    }
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setIsSubmitting(true);
    try {
      const result = await register({ companyName, industry: industry || undefined, ownerName: fullName, email, password });
      pendingSession.current = result.pending ? result.session ?? null : null;
      setDone({
        email: result.user.email,
        status: result.pending ? "pending" : "active",
        approval: result.approval,
        supportEmail: result.supportEmail,
      });
    } catch (err) {
      const apiErr = err as ApiError;
      const message = apiErr.message || "We couldn't create your account. Please try again.";
      if (apiErr.data?.code === "account_exists") {
        setExistingAccount(email.trim().toLowerCase());
        setIsSubmitting(false);
        return;
      }
      // Put the server's answer next to the field it's about.
      if (apiErr.status === 409 || /email/i.test(message)) setFieldErrors({ email: message });
      else if (/password/i.test(message)) setFieldErrors({ password: message });
      else if (!apiErr.notified) setFormError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* LEFT — Info panel */}
      <AuthHeroPanel className="lg:w-1/2 flex flex-col justify-between p-8 lg:p-16">
        <div className="relative z-20 flex flex-col justify-between gap-8 h-full">
          <span className="flex items-center gap-2 text-xl font-bold text-white">
            <BrandIcon variant="light" className="h-6 w-6" />
            FIGBLOOM FLEET
          </span>

          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Set up your
              <br />
              account.
            </h1>
            <p className="text-gray-200 max-w-xs">
              Set up your fleet, whether it&apos;s a business or just a few vehicles of your own. You add your vehicles and
              drivers yourself once you&apos;re in.
            </p>

            <div className="mt-5">
              <p className="text-xs text-gray-300 mb-2">The driver app</p>
              <DriverAppBadge />
            </div>
          </div>

          <p className="text-sm text-gray-200">
            Already have an account?{" "}
            <a href="/login" className="text-teal-200 font-medium hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </AuthHeroPanel>

      {/* RIGHT — Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-8">
        {done ? (
          <RegistrationDone
            companyName={companyName}
            email={done.email}
            status={done.status}
            approval={done.approval}
            supportEmail={done.supportEmail}
            onOpenDashboard={openDashboard}
          />
        ) : (
          <div className="w-full max-w-sm">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-teal-950 mb-2">Create your account</h2>
            <p className="text-sm text-gray-500 mb-8">No registered business needed. All fields are required unless marked optional.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearError("fullName");
                    if (!fleetNameEdited) setCompanyName(defaultFleetName(e.target.value));
                  }}
                  placeholder="Your full name"
                  aria-invalid={!!fieldErrors.fullName}
                  aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
                  className={inputClass(!!fieldErrors.fullName)}
                />
                {fieldErrors.fullName && (
                  <p id="fullName-error" className="mt-1.5 text-xs text-red-600">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  What should we call your fleet?
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setFleetNameEdited(e.target.value !== "");
                    clearError("companyName");
                  }}
                  placeholder="e.g. Amina's Fleet"
                  aria-invalid={!!fieldErrors.companyName}
                  aria-describedby="companyName-hint"
                  className={inputClass(!!fieldErrors.companyName)}
                />
                <p id="companyName-hint" className={`mt-1.5 text-xs ${fieldErrors.companyName ? "text-red-600" : "text-gray-500"}`}>
                  {fieldErrors.companyName ?? "Your business name, or just your own name. You can change it later."}
                </p>
              </div>

              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Industry <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <select
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className={inputClass(false)}
                >
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>

                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  {INDUSTRIES_WITH_IMAGES.map((slug) => {
                    const label = INDUSTRIES.find((i) => i.value === slug)?.label ?? slug;
                    return (
                      <button
                        type="button"
                        key={slug}
                        onClick={() => setIndustry(slug)}
                        title={label}
                        aria-label={label}
                        aria-pressed={industry === slug}
                        className={`aspect-square overflow-hidden rounded ring-1 transition-all ${
                          industry === slug ? "ring-2 ring-teal-600" : "ring-gray-200 hover:ring-teal-400"
                        }`}
                      >
                        <img src={`/industries/${slug}.jpg`} alt="" className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError("email");
                  }}
                  placeholder="you@example.com"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  className={inputClass(!!fieldErrors.email)}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="mt-1.5 text-xs text-red-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError("password");
                  }}
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby="password-hint"
                  className={inputClass(!!fieldErrors.password)}
                />
                {/* The rule up front, and whether it's met as they type */}
                <p
                  id="password-hint"
                  className={`mt-1.5 text-xs ${
                    fieldErrors.password ? "text-red-600" : password.length >= MIN_PASSWORD ? "text-teal-700" : "text-gray-500"
                  }`}
                >
                  {fieldErrors.password ??
                    (password.length >= MIN_PASSWORD ? `✓ At least ${MIN_PASSWORD} characters` : `At least ${MIN_PASSWORD} characters.`)}
                </p>
              </div>

              <RobotCheckbox checked={isHuman} onChange={setIsHuman} />

              {existingAccount && (
                <div className="rounded border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  <p className="font-medium">You already have a FIGBLOOM FLEET account with {existingAccount}.</p>
                  <p className="mt-1 text-xs text-teal-800">
                    Sign in with it, and we&apos;ll add {companyName.trim() || "your new fleet"} to your account. You keep one sign-in for all your
                    fleets, and you can move between them from the menu at the top.
                  </p>
                  <Link
                    href={`/login?next=${encodeURIComponent(
                      `/new-fleet?${new URLSearchParams({ name: companyName.trim(), ...(industry ? { industry } : {}) })}`
                    )}`}
                    className="mt-3 inline-block rounded bg-orange-500 px-4 py-2 text-xs font-medium text-white hover:bg-orange-600"
                  >
                    Sign in to add this fleet
                  </Link>
                </div>
              )}
              {formError && (
                <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting || !isHuman}
                  aria-describedby={!isHuman ? "register-robot-hint" : undefined}
                  className="w-full py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                >
                  {isSubmitting ? "Creating your account…" : "Create account"}
                </button>
                {!isHuman && (
                  <p id="register-robot-hint" className="mt-1.5 text-center text-xs text-gray-500">
                    Tick &quot;I&apos;m not a robot&quot; above to continue.
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
