export default function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`shrink-0 w-11 h-6 rounded-full px-0.5 flex items-center transition-colors ${
          checked ? "bg-gray-700 justify-start" : "bg-gray-200 justify-end"
        }`}
      >
        <span className="w-5 h-5 bg-white rounded-full shadow-sm" />
      </button>
    </div>
  );
}

