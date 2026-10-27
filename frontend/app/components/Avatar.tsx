import { API_URL } from "../lib/api";

const SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

// A person's profile picture (round) or a company logo (rounded square),
// falling back to their initials on a tinted background.
export default function Avatar({
  src,
  name,
  size = "sm",
  shape = "circle",
  className = "",
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  shape?: "circle" | "square";
  className?: string;
}) {
  const round = shape === "circle" ? "rounded-full" : "rounded-lg";
  if (src) {
    return (
      <img
        src={API_URL + src}
        alt=""
        className={`${SIZES[size]} ${round} shrink-0 bg-gray-100 object-cover ring-1 ring-black/5 ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} ${round} inline-flex shrink-0 items-center justify-center bg-teal-100 font-semibold text-teal-800 ${className}`}
    >
      {initials(name) || "?"}
    </span>
  );
}
