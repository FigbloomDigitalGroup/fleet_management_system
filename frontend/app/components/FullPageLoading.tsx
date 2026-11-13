"use client";

import { CSSProperties } from "react";
import localFont from "next/font/local";
import { useInShell } from "./InShell";

// Self-hosted (app/fonts, SIL OFL) so the build never fetches Google Fonts.
const outfit = localFont({
  src: "../fonts/outfit-latin-300-normal.woff2",
  weight: "300",
  style: "normal",
  display: "swap",
});

// The Fig Fleet logo with the "Orbit" ring sweeping round it in the brand
// green and orange (styles in globals.css, .fb-loader).
function LoaderMark({ label, size }: { label: string; size?: string }) {
  return (
    <div
      className="fb-loader flex flex-col items-center gap-8"
      role="status"
      aria-live="polite"
      style={size ? ({ "--fb-size": size } as CSSProperties) : undefined}
    >
      <div className="relative" style={{ width: "var(--fb-size)", height: "var(--fb-size)" }}>
        <svg viewBox="8 5 48 48" aria-hidden="true" className="absolute inset-0">
          <circle
            className="fb-arc"
            cx="32"
            cy="29"
            r="21"
            pathLength="360"
            fill="none"
            stroke="var(--fb-green)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <img
          src="/brand/figfleet-icon-dark.png"
          alt=""
          aria-hidden="true"
          className="fb-logo absolute left-1/2 top-1/2 h-[52%] -translate-x-1/2 -translate-y-1/2 object-contain"
        />
      </div>
      <div className={`${outfit.className} text-lg tracking-[.02em] text-[#3E5A48]`}>
        {label}
        <span className="fb-loader__dot">.</span>
        <span className="fb-loader__dot">.</span>
        <span className="fb-loader__dot">.</span>
      </div>
    </div>
  );
}

// Loading inside the shell's content pane (a page's data, or the next page
// after a menu click): the menu and header stay where they are.
export function ContentLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center py-10">
      <LoaderMark label={label} size="120px" />
    </div>
  );
}

// Full-screen loading state for before the shell exists (checking the
// sign-in). Inside the shell it falls back to ContentLoading, so a page
// loading its data never blanks the whole screen.
export default function FullPageLoading({ label = "Getting things ready" }: { label?: string }) {
  const inShell = useInShell();
  if (inShell) return <ContentLoading label={label} />;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <LoaderMark label={label} />
    </div>
  );
}
