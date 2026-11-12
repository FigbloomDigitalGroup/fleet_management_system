import { FaGooglePlay } from "react-icons/fa";

// The driver app isn't on Google Play yet. This badge says so instead of
// linking nowhere; swap it for a real store link once the listing is live.
export default function DriverAppBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-disabled="true"
      title="The driver app is coming soon to Google Play"
      className={`inline-flex cursor-default items-center gap-3 rounded-md bg-black/60 px-4 py-2 text-white ring-1 ring-white/10 ${className}`}
    >
      <FaGooglePlay size={22} aria-hidden="true" />
      <span className="text-left">
        <span className="block text-[9px] uppercase tracking-wide text-gray-300">Coming soon on</span>
        <span className="block text-sm font-semibold leading-tight">Google Play</span>
      </span>
    </span>
  );
}
