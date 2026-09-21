import { Suspense } from "react";
import { FaCog } from "react-icons/fa";
import BackgroundSlideshow from "../components/BackgroundSlideshow";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* LEFT — Hero panel */}
      <BackgroundSlideshow className="lg:w-1/2 flex flex-col justify-between p-10 lg:p-16">
        <div className="absolute inset-0 z-10 bg-black/50" />

        <div className="relative z-20 flex flex-col justify-between h-full">
          <span className="flex items-center gap-2 text-xl font-bold text-white">
            <FaCog aria-hidden="true" />
            FIGBLOOM FLEET
          </span>

          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Choose a new
              <br />
              password.
            </h1>
            <p className="text-gray-200 max-w-xs">
              Make it something you haven&apos;t used before.
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
          <h2 className="text-5xl font-extrabold text-blue-950 mb-2">New password</h2>
          <p className="text-sm text-gray-500 mb-8">Enter and confirm your new password.</p>

          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>

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
