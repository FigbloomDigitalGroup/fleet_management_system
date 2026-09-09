import { FaCog } from "react-icons/fa";

export default function FullPageLoading({ label = "Loading" }: { label?: string }) {
  const dots = [
    { size: 14, delay: "0s" },
    { size: 11, delay: "0.12s" },
    { size: 9, delay: "0.24s" },
    { size: 7, delay: "0.36s" },
    { size: 5, delay: "0.48s" },
  ];

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <span className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
        <FaCog aria-hidden="true" className="text-indigo-400" />
        DETOUR
      </span>
      <div className="flex items-end gap-2">
        {dots.map((dot, i) => (
          <span
            key={i}
            className="loading-dot rounded-full bg-indigo-400"
            style={{
              width: dot.size,
              height: dot.size,
              animationDelay: dot.delay,
            }}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">{label}</p>
    </div>
  );
}