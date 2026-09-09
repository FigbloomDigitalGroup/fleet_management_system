"use client";

import { useState, FormEvent, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import { FaCog } from "react-icons/fa";
import BackgroundSlideshow from "../components/BackgroundSlideshow";

type AccountType = "SITE_OWNER" | "ADMIN" | "DRIVER";

const ACCOUNT_TYPES: {
    value: AccountType;
    label: string;
    icon: JSX.Element;
}[] = [
        {
            value: "SITE_OWNER",
            label: "Vehicle Company",
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01M9 7h.01M15 7h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
        },
        {
            value: "ADMIN",
            label: "Admin",
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="8" r="3.2" strokeLinecap="round" />
                    <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M17.5 5.5l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
        },
        {
            value: "DRIVER",
            label: "Driver",
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 16l1.5-5.5A2 2 0 0 1 7.4 9h9.2a2 2 0 0 1 1.9 1.5L20 16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 16h18v3a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="7.5" cy="16" r="1.3" />
                    <circle cx="16.5" cy="16" r="1.3" />
                </svg>
            ),
        },
    ];

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();

    const [accountType, setAccountType] = useState<AccountType>("SITE_OWNER");
    const [companyName, setCompanyName] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    function selectType(type: AccountType) {
        setAccountType(type);
        setError(null);
        setNotice(null);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setNotice(null);

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setIsSubmitting(true);

        if (accountType === "SITE_OWNER") {
            try {
                const user = await register({ companyName, ownerName: fullName, email, password });
                router.push(redirectPathForRole(user.role));
            } catch (err: any) {
                setError(err.message || "Unable to create your account. Please try again.");
                setIsSubmitting(false);
            }
            return;
        }

        // Admin / Driver: no public self-registration endpoint yet —
        // these accounts are created by someone above them in the hierarchy.
        setIsSubmitting(false);
        setNotice(
            accountType === "ADMIN"
                ? "Admin accounts are added by your company's Site Owner. Share these details with them, or ask them to add you directly — then sign in once your account exists."
                : "Driver accounts are added by your company's Admin. Share these details with them, or ask them to add you directly — then sign in once your account exists."
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col lg:flex-row">
            {/* LEFT — Info panel */}



            {/* LEFT — Info panel */}
            <BackgroundSlideshow className="lg:w-1/2 flex flex-col justify-between p-10 lg:p-16 border-r border-gray-200">
                <div className="absolute inset-0 z-10 bg-black/50" />

                <div className="relative z-20 flex flex-col justify-between h-full">
                    <span className="flex items-center gap-2 text-xl font-bold text-white">
                        <FaCog aria-hidden="true" />
                        DETOUR
                    </span>

                    <div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
                            Set up your
                            <br />
                            account.
                        </h1>
                        <p className="text-gray-200 max-w-xs">
                            Vehicle companies register directly. Admins and drivers are added
                            by whoever manages their account.
                        </p>
                    </div>

                    <p className="text-sm text-gray-200">
                        Already have an account?{" "}
                        <a href="/login" className="text-green-600 font-medium hover:underline">
                            Sign in
                        </a>
                    </p>
                </div>
            </BackgroundSlideshow>


            {/* RIGHT — Form panel */}
            <div className="lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-sm">
                    <h2 className="text-5xl font-extrabold text-blue-950 mb-2">Create your account</h2>
                    <p className="text-sm text-gray-500 mb-6">Tell us who you are.</p>

                    {/* Role cubes */}
                    <div className="flex gap-3 mb-8">
                        {ACCOUNT_TYPES.map((t) => {
                            const active = accountType === t.value;
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => selectType(t.value)}
                                    className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-lg text-xs font-medium border transition-colors ${active
                                        ? "border-green-600 bg-green-50 text-green-500"
                                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                                        }`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {accountType === "SITE_OWNER" && (
                            <div>
                                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Company name
                                </label>
                                <input
                                    id="companyName"
                                    type="text"
                                    required
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Acme Logistics"
                                    className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                                />
                            </div>
                        )}

                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Full name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Jane Doe"
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                                {accountType === "SITE_OWNER" ? "Work email" : "Email"}
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="jane@acme.com"
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                            />
                        </div>

                        {accountType !== "SITE_OWNER" && (
                            <div>
                                <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Company name{" "}
                                    <span className="text-xs text-gray-400">
                                        (ask your {accountType === "ADMIN" ? "Site Owner" : "Admin"})
                                    </span>
                                </label>
                                <input
                                    id="inviteCode"
                                    type="text"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                    placeholder="Acme Logistics"
                                    className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                                />
                            </div>
                        )}

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                            />
                        </div>

                        {error && (
                            <div className="text-sm px-3.5 py-2.5 rounded-md bg-red-50 text-red-600 border border-red-200" role="alert">
                                {error}
                            </div>
                        )}

                        {notice && (
                            <div className="text-sm px-3.5 py-2.5 rounded-md bg-green-50 text-green-600 border border-green-200">
                                {notice}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                        >
                            {isSubmitting
                                ? "Submitting…"
                                : accountType === "SITE_OWNER"
                                    ? "Create account"
                                    : "Submit details"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}