"use client";

import Link from "next/link";

// What a new company owner sees right after registering: whether they can
// start now or are waiting for approval, how long that usually takes, and
// what the first few steps inside the app will be.

const NEXT_STEPS = [
    { title: "Sign in as Company owner", text: "You land on your Overview, with a Getting started checklist." },
    { title: "Add your vehicles and drivers", text: "You can do it yourself right away. Each driver signs in to the FIGBLOOM FLEET app on their phone." },
    { title: "Watch the live map", text: "Vehicles appear as soon as their driver app or tracker sends a location." },
    { title: "Invite help if you want it", text: "Optional: give a fleet admin their own login. You can also run everything yourself." },
];

export default function RegistrationDone({
    companyName,
    email,
    status,
    onOpenDashboard,
}: {
    companyName: string;
    email: string;
    status: "active" | "pending";
    onOpenDashboard: () => void;
}) {
    const active = status === "active";

    return (
        <div className="w-full max-w-sm" role="status" aria-live="polite">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            </div>

            {active ? (
                <>
                    <h2 className="text-3xl font-extrabold text-teal-950 mb-3">You&apos;re all set</h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        <span className="font-semibold text-gray-800">{companyName}</span> is active and ready to use. We&apos;ve
                        also sent a welcome email to <span className="font-semibold text-gray-800">{email}</span>.
                    </p>
                    <button
                        type="button"
                        onClick={onOpenDashboard}
                        className="mt-6 w-full py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
                    >
                        Sign in now
                    </button>
                </>
            ) : (
                <>
                    <h2 className="text-3xl font-extrabold text-teal-950 mb-3">Application received</h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Thanks for registering <span className="font-semibold text-gray-800">{companyName}</span>. Your
                        account is being switched on. That usually takes a minute or two; if it needs a manual review it can
                        take up to one working day.
                    </p>
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                        We&apos;ll email <span className="font-semibold text-gray-800">{email}</span> the moment it&apos;s
                        active. If you keep this page open, it will update by itself.
                    </p>
                    <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" aria-hidden="true" />
                        Waiting for approval
                    </p>
                    <Link
                        href="/login"
                        className="mt-6 inline-block w-full text-center py-2.5 rounded text-sm font-medium text-teal-700 border border-teal-600 hover:bg-teal-50"
                    >
                        Go to sign in
                    </Link>
                </>
            )}

            <div className="mt-8 border-t border-gray-100 pt-6">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">What happens next</p>
                <ol className="space-y-3">
                    {NEXT_STEPS.map((step, i) => (
                        <li key={step.title} className="flex gap-3">
                            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                                {i + 1}
                            </span>
                            <span>
                                <span className="block text-sm font-medium text-gray-800">{step.title}</span>
                                <span className="block text-xs text-gray-500">{step.text}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            <Link href="/" className="mt-6 inline-block text-sm text-gray-500 hover:text-teal-700">
                Back to home
            </Link>
        </div>
    );
}
