import { Outfit } from "next/font/google";

const outfit = Outfit({ weight: "300", subsets: ["latin"] });

// Full-screen loading state — the Figbloom "Orbit" loader (styles in
// globals.css, .fb-loader).
export default function FullPageLoading({ label = "Getting things ready" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="fb-loader flex flex-col items-center gap-8" role="status" aria-live="polite">
        <svg viewBox="8 5 48 48" aria-hidden="true">
          <circle
            className="fb-arc"
            cx="32"
            cy="29"
            r="19"
            pathLength="360"
            fill="none"
            stroke="#0E4F27"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <circle className="fb-bowl" cx="32" cy="29" r="9" fill="none" stroke="#0E4F27" strokeWidth="6.5" />
          <path className="fb-leaf" d="M33 14.5 C33 8.5 38 5.5 43 5.5 C43 11.5 39 14.5 33 14.5 Z" fill="#0E4F27" />
        </svg>
        <div className={`${outfit.className} text-lg tracking-[.02em] text-[#3E5A48]`}>
          {label}
          <span className="fb-loader__dot">.</span>
          <span className="fb-loader__dot">.</span>
          <span className="fb-loader__dot">.</span>
        </div>
      </div>
    </div>
  );
}
