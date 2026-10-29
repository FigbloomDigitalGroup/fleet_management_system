import { Outfit } from "next/font/google";

const outfit = Outfit({ weight: "300", subsets: ["latin"] });

// Full-screen loading state — the Fig Fleet logo with the "Orbit" ring
// sweeping round it in the brand green and orange (styles in globals.css,
// .fb-loader).
export default function FullPageLoading({ label = "Getting things ready" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="fb-loader flex flex-col items-center gap-8" role="status" aria-live="polite">
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
    </div>
  );
}
