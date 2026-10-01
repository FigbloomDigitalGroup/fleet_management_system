"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import { FaGooglePlay } from "react-icons/fa";
import BackgroundSlideshow from "../components/BackgroundSlideshow";
import RobotCheckbox from "../components/RobotCheckbox";
import BrandIcon from "../components/BrandIcon";
import { INDUSTRIES, INDUSTRIES_WITH_IMAGES } from "../lib/industries";

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();

    const [companyName, setCompanyName] = useState("");
    const [industry, setIndustry] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isHuman, setIsHuman] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setIsSubmitting(true);
        try {
            const user = await register({ companyName, industry: industry || undefined, ownerName: fullName, email, password });
            router.push(redirectPathForRole(user.role));
        } catch (err: any) {
            setError(err.message || "Unable to create your account. Please try again.");
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-white flex flex-col lg:flex-row">
            {/* LEFT — Info panel */}
            <BackgroundSlideshow className="lg:w-1/2 flex flex-col justify-between p-10 lg:p-16">
                <div className="absolute inset-0 z-10 bg-black/50" />

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
                            Register your vehicle company to get started. Admins and drivers
                            are added by whoever manages their account, then sign in directly.
                        </p>

                        <div className="mt-5">
                            <p className="text-xs text-gray-300 mb-2">Drivers — get the app</p>
                            <a
                                href="#"
                                className="inline-flex items-center gap-3 bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-xl transition-colors"
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
                        <a href="/login" className="text-teal-600 font-medium hover:underline">
                            Sign in
                        </a>
                    </p>
                </div>
            </BackgroundSlideshow>

            {/* RIGHT — Form panel */}
            <div className="lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-sm">
                    <h2 className="text-5xl font-extrabold text-teal-950 mb-2">Create your account</h2>
                    <p className="text-sm text-gray-500 mb-8">Register your vehicle company.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
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
                                placeholder="Your company name"
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                        </div>

                        <div>
                            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Industry
                            </label>
                            <select
                                id="industry"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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
                                        className={`aspect-square overflow-hidden rounded-md ring-1 transition-all ${industry === slug ? "ring-2 ring-teal-600" : "ring-gray-200 hover:ring-teal-400"
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
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Full name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Your full name"
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Work email
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Your work email"
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                        </div>

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
                                placeholder="Your password"
                                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                            />
                        </div>

                        <RobotCheckbox checked={isHuman} onChange={setIsHuman} />

                        {error && (
                            <div className="text-sm px-3.5 py-2.5 rounded-md bg-red-50 text-red-600 border border-red-200" role="alert">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !isHuman}
                            className="w-full py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                        >
                            {isSubmitting ? "Submitting…" : "Create account"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
