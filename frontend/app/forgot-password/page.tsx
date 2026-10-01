"use client";

import { useState, FormEvent } from "react";
import BackgroundSlideshow from "../components/BackgroundSlideshow";
import RobotCheckbox from "../components/RobotCheckbox";
import BrandIcon from "../components/BrandIcon";
import { apiRequest } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHuman, setIsHuman] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Unable to process your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* LEFT — Hero panel */}
      <BackgroundSlideshow className="lg:w-1/2 flex flex-col justify-between p-10 lg:p-16">
        <div className="absolute inset-0 z-10 bg-black/50" />

        <div className="relative z-20 flex flex-col justify-between h-full">
          <span className="flex items-center gap-2 text-xl font-bold text-white">
            <BrandIcon variant="light" className="h-6 w-6" />
            FIGBLOOM FLEET
          </span>

          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Forgot your
              <br />
              password?
            </h1>
            <p className="text-gray-200 max-w-xs">
              Enter the email on your account and we&apos;ll help you get back in.
            </p>
          </div>

          <p className="text-sm text-gray-200">
            Remembered it?{" "}
            <a href="/login" className="text-teal-600 font-medium hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </BackgroundSlideshow>

      {/* RIGHT — Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-5xl font-extrabold text-teal-950 mb-2">Reset password</h2>
          <p className="text-sm text-gray-500 mb-8">
            We&apos;ll send instructions to reset your password.
          </p>

          {sent ? (
            <div className="text-sm px-3.5 py-2.5 rounded-md bg-teal-50 text-teal-600 border border-teal-200">
              If an account exists for {email}, we&apos;ve sent instructions to reset the password.
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
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
                {isSubmitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <p className="text-sm text-gray-500 mt-8">
            <a href="/login" className="text-teal-500 font-medium hover:underline">
              Back to sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
