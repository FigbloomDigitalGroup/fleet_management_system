"use client";

import Link from "next/link";
import { IconType } from "react-icons";

export interface EmptyStateAction {
  label: string;
  href: string;
}

// What a page shows before it has anything in it: one line on what the page
// is for, and the one thing to do next. Same look as the Alerts page's
// "All clear" state.
export default function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  compact = false,
}: {
  icon?: IconType;
  title: string;
  text: string;
  action?: EmptyStateAction | null;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${compact ? "px-4 py-6" : "px-5 py-12"}`}>
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <Icon size={20} />
        </span>
      )}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="max-w-sm text-xs text-gray-500">{text}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-2 rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
