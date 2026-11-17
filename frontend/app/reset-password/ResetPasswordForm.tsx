"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiRequest } from "../lib/api";
import { FIGBLOOM_PASSWORD_RULE, figbloomSignInEnabled } from "../lib/figbloomSignIn";
import PasswordInput from "../components/PasswordInput";
import { notifyError, showError } from "../lib/notify";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // figbloom: the link set the person's Figbloom password (not Fleet's)
  const [done, setDone] = useState<false | { figbloom: boolean }>(false);
  // Their Figbloom account already has a password: it changes on Figbloom's sign-in page.
  const [useFigbloomReset, setUseFigbloomReset] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linkIsValid = Boolean(email && token);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      notifyError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      notifyError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiRequest<{ figbloom?: boolean }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, token, newPassword: password }),
        notifyErrors: false,
        successMessage: false,
      });
      setDone({ figbloom: !!data.figbloom });
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      if ((err as ApiError).data?.code === "use_figbloom_reset") setUseFigbloomReset(true);
      else if (!(err as ApiError).notified) showError(err, "Unable to reset your password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!linkIsValid) {
    return (
      <div className="text-sm px-3.5 py-2.5 rounded bg-red-50 text-red-600 border border-red-200" role="alert">
        This reset link is missing or invalid.{" "}
        <a href="/forgot-password" className="font-medium underline">
          Request a new one
        </a>
        .
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-sm px-3.5 py-2.5 rounded bg-teal-50 text-teal-600 border border-teal-200">
        {done.figbloom
          ? "Your Figbloom password is set. Taking you to sign in: choose \"Sign in with Figbloom\"…"
          : "Your password has been updated. Taking you to sign in…"}
      </div>
    );
  }

  if (useFigbloomReset) {
    return (
      <div className="text-sm px-3.5 py-2.5 rounded bg-teal-50 text-teal-800 border border-teal-200" role="alert">
        You already have a Figbloom password. To change it, choose &quot;Sign in with Figbloom&quot;, then &quot;Forgot password&quot; on
        Figbloom&apos;s sign-in page.{" "}
        <a href="/login" className="font-medium underline">
          Go to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
          New password
        </label>
        <PasswordInput
          id="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={figbloomSignInEnabled() ? "At least 8 characters" : "Your new password"}
          className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
        />
        {figbloomSignInEnabled() && (
          <p className="mt-1.5 text-xs text-gray-500">
            For your Figbloom account: {FIGBLOOM_PASSWORD_RULE}. The driver app needs at least 8 characters.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
          Confirm password
        </label>
        <PasswordInput
          id="confirmPassword"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your new password"
          className="w-full px-3.5 py-2.5 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
        />
      </div>


      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
      >
        {isSubmitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
