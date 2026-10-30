import BrandIcon from "./BrandIcon";

// Gear teeth around the G, as angles clockwise from 12 o'clock. 45° is
// left out — that's where the G opens.
const G_TEETH = [0, 90, 135, 180, 225, 270, 315];

// A "G" drawn as a gear: a ring open at the top right, the G's crossbar
// running in from 3 o'clock, and teeth around the outside.
function GearG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19 12 A7 7 0 1 1 15.5 5.94" fill="none" stroke="currentColor" strokeWidth={3.4} />
      <rect x={12.4} y={10.3} width={8.2} height={3.4} rx={0.4} />
      {G_TEETH.map((angle) => (
        <rect key={angle} x={10.3} y={1} width={3.4} height={3} rx={0.6} transform={`rotate(${angle} 12 12)`} />
      ))}
    </svg>
  );
}

// The logo lockup: the glyph, then "FIGBLOOM" with a gear-shaped G and
// "FLEET" spread in small letters underneath, the same width. "dark" is for
// white backgrounds, "light" for dark ones (as BrandIcon).
export default function BrandWordmark({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const text = variant === "dark" ? "text-teal-950" : "text-white";
  const sub = variant === "dark" ? "text-teal-600" : "text-teal-200";

  return (
    <span className={`inline-flex items-center gap-2 ${text}`} aria-label="FIGBLOOM FLEET" role="img">
      <BrandIcon variant={variant} className="h-8 w-8" />
      <span aria-hidden="true" className="inline-flex flex-col leading-none">
        <span className="flex items-center text-lg font-extrabold tracking-tight">
          FI
          <GearG className="mx-[0.02em] h-[1em] w-[1em] text-orange-500" />
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
