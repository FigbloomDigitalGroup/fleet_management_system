"use client";

import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import { FaShieldAlt } from "react-icons/fa";

// A self-hosted "I'm not a robot" checkbox, styled after the familiar
// reCAPTCHA widget — a UI deterrent against trivial bots submitting these
// forms directly, not real bot verification (no external service).
export default function RobotCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [verifying, setVerifying] = useState(false);

  function handleClick() {
    if (checked || verifying) return;
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      onChange(true);
    }, 900 + Math.random() * 500);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-300 bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          aria-pressed={checked}
          aria-label="Confirm you're not a robot"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            checked ? "border-teal-600 bg-teal-600" : "border-gray-400 bg-white hover:border-teal-500"
          }`}
        >
          {verifying ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          ) : checked ? (
            <FiCheck size={16} className="text-white" />
          ) : null}
        </button>
        <span className="text-sm text-gray-700">I&apos;m not a robot</span>
      </div>
      <FaShieldAlt className="text-gray-300" size={22} aria-hidden="true" />
    </div>
  );
}
