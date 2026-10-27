// On/off switch used everywhere instead of checkboxes: the knob slides right
// (teal) when on, left (grey) when off.
export default function Switch({
  checked,
  onChange,
  disabled = false,
  size = "md",
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  // Accessible name when there's no visible <label> around the switch.
  label?: string;
}) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const travel = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-40 ${track} ${
        checked ? "bg-teal-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`${knob} rounded-full bg-white shadow-sm transition-transform ${checked ? travel : "translate-x-0"}`}
      />
    </button>
  );
}
