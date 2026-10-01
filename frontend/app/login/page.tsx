"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import { FaGooglePlay } from "react-icons/fa";
import BackgroundSlideshow from "../components/BackgroundSlideshow";
import RobotCheckbox from "../components/RobotCheckbox";
import BrandIcon from "../components/BrandIcon";

const STEPS = [
  { n: 1, title: "Register your company", text: "Create your account in minutes and set up your company profile." },
  { n: 2, title: "Add vehicles & drivers", text: "Register each vehicle, assign a driver, and set up alerts or zones." },
  { n: 3, title: "Track live, get alerted", text: "Watch your fleet move in real time, and get notified the moment something needs attention." },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHuman, setIsHuman] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(email, password);
      router.push(redirectPathForRole(user.role));
    } catch (err: any) {
      setError(err.message || "Unable to sign in. Check your details and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* LEFT — Hero panel */}


      {/* LEFT — Hero panel */}
      <BackgroundSlideshow className="lg:w-1/2 flex flex-col justify-between p-10 lg:p-16">
        {/* dark overlay so text stays readable over the image */}
        <div className="absolute inset-0 z-10 bg-black/50" />

        {/* wrap all existing content in a relative div so it sits above the overlay */}
        <div className="relative z-20 flex flex-col justify-between h-full">
          <span className="flex items-center gap-2 text-xl font-bold text-white">
            <BrandIcon variant="light" className="h-6 w-6" />
            FIGBLOOM FLEET
          </span>

          <div className="flex-1 flex flex-col justify-center py-16">
            <span className="text-xs uppercase tracking-wide text-teal-300 font-bold mb-5 block">
              How it works
            </span>
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
              Live tracking, trip history, and fleet analytics in one place
              for owners, admins and drivers alike.
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
        </div>
      </BackgroundSlideshow>

      {/* RIGHT — Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-5xl font-extrabold text-teal-950 mb-2">Sign in</h2>
          <p className="text-sm text-gray-500 mb-8">Enter your details to reach your dashboard.</p>

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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-3.5 py-2.5 pr-16 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500"
                >
                  {showPassword ? "hide" : "show"}
                </button>
              </div>
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
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-sm text-gray-500 mt-8">
            Registering a new company?{" "}
            <a href="/register" className="text-teal-500 font-medium hover:underline">
              Set up your account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}


















