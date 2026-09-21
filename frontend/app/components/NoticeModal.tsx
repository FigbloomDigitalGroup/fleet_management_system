"use client";

import { IconType } from "react-icons";

interface NoticeModalProps {
  icon: IconType;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

// Centered card-on-overlay notice, reused for any "here's what just
// happened" moment (session timeout today, more later) rather than one-off
// modals per use case.
export default function NoticeModal({
  icon: Icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: NoticeModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
          <Icon size={24} className="text-teal-600" />
        </div>

        <h2 className="mt-4 text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1.5 text-sm text-gray-500">{description}</p>

        <div className="mt-6 flex gap-2">
          {secondaryLabel && (
            <button
              onClick={onSecondary}
              className="flex-1 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            onClick={onPrimary}
            className="flex-1 rounded-md bg-orange-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
