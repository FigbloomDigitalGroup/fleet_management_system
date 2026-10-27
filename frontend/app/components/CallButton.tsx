import { FiPhone } from "react-icons/fi";

// Calls a driver from the dashboard: a tel: link, which the computer hands to
// its calling app (Phone Link, Teams, Skype…) and a phone dials directly.
// Greyed out until the driver adds a phone number in the app's profile.
export default function CallButton({
  phone,
  name,
  size = "sm",
  label = "Call",
}: {
  phone?: string | null;
  name?: string;
  size?: "xs" | "sm";
  label?: string;
}) {
  const pad = size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  if (!phone) {
    return (
      <span
        title={`${name ?? "This driver"} hasn't added a phone number yet`}
        className={`inline-flex cursor-not-allowed items-center gap-1.5 rounded bg-gray-100 font-medium text-gray-400 ${pad}`}
      >
        <FiPhone size={12} /> {label}
      </span>
    );
  }
  return (
    <a
      href={`tel:${phone.replace(/\s+/g, "")}`}
      title={`Call ${name ?? "driver"} on ${phone}`}
      className={`inline-flex items-center gap-1.5 rounded bg-teal-600 font-medium text-white transition-colors hover:bg-teal-700 ${pad}`}
    >
      <FiPhone size={12} /> {label}
    </a>
  );
}
