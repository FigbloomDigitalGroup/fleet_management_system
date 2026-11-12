"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import { FaGooglePlay } from "react-icons/fa";
import AuthHeroPanel from "../components/AuthHeroPanel";
import RobotCheckbox from "../components/RobotCheckbox";
import BrandIcon from "../components/BrandIcon";
import PasswordInput from "../components/PasswordInput";
import { INDUSTRIES, INDUSTRIES_WITH_IMAGES } from "../lib/industries";
import { notifyError, showError } from "../lib/notify";
import { API_URL } from "../lib/api";
import { LoginResponse } from "../types/auth";
import RegistrationDone from "./RegistrationDone";
import { defaultFleetName } from "../lib/fleetName";

export default function RegisterPage() {
    const { register, adoptSession } = useAuth();
    const router = useRouter();

    const [companyName, setCompanyName] = useState("");
    // Once the owner edits the fleet name themselves, stop filling it in.
    const [fleetNameEdited, setFleetNameEdited] = useState(false);
    const [industry, setIndustry] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isHuman, setIsHuman] = useState(false);
    // Set once the company is registered: "active" when it can be used right
    // away, "pending" while it waits for approval in the Figbloom console.
    const [done, setDone] = useState<{ email: string; status: "active" | "pending" } | null>(null);
    // A pending registration's tokens, kept in memory only (never stored), so
    // the page can notice the company being switched on and sign straight in.
    const pendingSession = useRef<LoginResponse | null>(null);

    // Most Fleet companies are approved automatically a minute or so after
    // registering (the platform sync runs every minute). While the owner is
    // still on this page, check quietly every 15s for up to 10 minutes and
    // flip to "you're in" when it happens. The approval email covers the rest.
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

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (password.length < 8) {
            notifyError("Password must be at least 8 characters.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { user, pending, session } = await register({ companyName, industry: industry || undefined, ownerName: fullName, email, password });
            pendingSession.current = pending ? session ?? null : null;
            setDone({ email: user.email, status: pending ? "pending" : "active" });
        } catch (err: any) {
            showError(err, "Unable to create your account. Please try again.");
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-white flex flex-col lg:flex-row">
            {/* LEFT — Info panel */}
            <AuthHeroPanel className="lg:w-1/2 flex flex-col justify-between p-10 lg:p-16">

                <div className="relative z-20 flex flex-col justify-between h-full">
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
                            Set up your fleet, whether it&apos;s a business or just a few vehicles of
                            your own. You add your vehicles and drivers yourself once you&apos;re in.
                        </p>

                        <div className="mt-5">
                            <p className="text-xs text-gray-300 mb-2">Drivers — get the app</p>
                            <a
                                href="#"
                                className="inline-flex items-center gap-3 bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-md transition-colors"
                            >
                                <FaGooglePlay size={22} />
                                <span className="text-left">
                                    <span className="block text-[9px] uppercase tracking-wide text-gray-300">Get it on</span>
                                    <span className="block text-sm font-semibold leading-tight">Google Play</span>
                                </span>
                            </a>
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
                    onOpenDashboard={openDashboard}
                />
                ) : (
                <div className="w-full max-w-sm">
                    <h2 className="text-5xl font-extrabold text-teal-950 mb-2">Create your account</h2>
                    <p className="text-sm text-gray-500 mb-8">No registered business needed.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Full name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => {
                                    setFullName(e.target.value);
                                    if (!fleetNameEdited) setCompanyName(defaultFleetName(e.target.value));
                                }}
                                placeholder="Your full name"
                                className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                        </div>

                        <div>
                            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">
                                What should we call your fleet?
                            </label>
                            <input
                                id="companyName"
                                type="text"
                                required
                                value={companyName}
                                onChange={(e) => {
                                    setCompanyName(e.target.value);
                                    setFleetNameEdited(e.target.value !== "");
                                }}
                                placeholder="e.g. Amina's Fleet"
                                aria-describedby="companyName-hint"
                                className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                            <p id="companyName-hint" className="mt-1.5 text-xs text-gray-500">
                                Your business name, or just your own name. You can change it later.
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
                                className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            >
                                <option value="">Select your industry</option>
                                {INDUSTRIES.map((i) => (
                                    <option key={i.value} value={i.value}>
                                        {i.label}
                                    </option>
                                ))}
                            </select>

                            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                                {INDUSTRIES_WITH_IMAGES.map((slug) => (
                                    <button
                                        type="button"
                                        key={slug}
                                        onClick={() => setIndustry(slug)}
                                        title={INDUSTRIES.find((i) => i.value === slug)?.label}
                                        className={`aspect-square overflow-hidden rounded ring-1 transition-all ${industry === slug ? "ring-2 ring-teal-600" : "ring-gray-200 hover:ring-teal-400"
                                            }`}
                                    >
                                        <img
                                            src={`/industries/${slug}.jpg`}
                                            alt=""
                                            className="h-full w-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

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
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Password
                            </label>
                            <PasswordInput
                                id="password"
                                required
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Your password"
                                className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                        </div>

                        <RobotCheckbox checked={isHuman} onChange={setIsHuman} />


                        <button
                            type="submit"
                            disabled={isSubmitting || !isHuman}
                            className="w-full py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                        >
                            {isSubmitting ? "Submitting…" : "Create account"}
                        </button>
                    </form>
                </div>
                )}
            </div>
        </div>
    );
}
