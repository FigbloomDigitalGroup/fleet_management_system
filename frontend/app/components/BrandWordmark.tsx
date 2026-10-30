import { FaCog } from "react-icons/fa";
import BrandIcon from "./BrandIcon";

// The logo lockup: the glyph, then "FIGBLOOM" with a gear for its G and
// "FLEET" spread in small letters underneath, the same width. "dark" is for
// white backgrounds, "light" for dark ones (as BrandIcon).
export default function BrandWordmark({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const text = variant === "dark" ? "text-teal-950" : "text-white";
  const sub = variant === "dark" ? "text-teal-600" : "text-teal-200";

  return (
    <span className={`group inline-flex items-center gap-2 ${text}`} aria-label="FIGBLOOM FLEET" role="img">
      <BrandIcon variant={variant} className="h-8 w-8" />
      <span aria-hidden="true" className="inline-flex flex-col leading-none">
        <span className="flex items-center text-lg font-extrabold tracking-tight">
          FI
          <FaCog className="wordmark-gear mx-[0.03em] h-[0.92em] w-[0.92em] text-orange-500" />
          BLOOM
        </span>
        <span className={`mt-0.5 flex justify-between text-[9px] font-semibold ${sub}`}>
          {"FLEET".split("").map((letter, i) => (
            <span key={i}>{letter}</span>
          ))}
        </span>
      </span>
    </span>
  );
}
