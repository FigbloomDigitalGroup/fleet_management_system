"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { redirectPathForRole } from "../lib/roleRedirect";
import { FaCog } from "react-icons/fa";
import BackgroundSlideshow from "../components/BackgroundSlideshow";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            <FaCog aria-hidden="true" />
            FIGBLOOM FLEET
          </span>

          <div className="flex-1 flex items-center justify-center py-16">
            {/* ...keep the existing svg exactly as it is... */}
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
          </div>
        </div>
      </BackgroundSlideshow>

      {/* RIGHT — Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-5xl font-extrabold text-blue-950 mb-2">Sign in</h2>
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
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {error && (
              <div className="text-sm px-3.5 py-2.5 rounded-md bg-red-50 text-red-600 border border-red-200" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
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


















