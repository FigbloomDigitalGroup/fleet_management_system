import BrandIcon from "./BrandIcon";

// The logo glyph used as the "g" of figbloom, in the accent orange: the
// PNG is a mask, so the colour comes from bg-orange-500 (and follows the
// company theme). It's 295×512, so it runs from the top of the letters down
// into the descender like a real g.
function GlyphG() {
  return (
    <span
      aria-hidden="true"
      className="mx-[0.03em] inline-block h-[1.08em] w-[0.62em] bg-orange-500 align-[-0.24em]"
      style={{
        maskImage: "url(/brand/figfleet-icon.png)",
        WebkitMaskImage: "url(/brand/figfleet-icon.png)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

// The logo lockup: the glyph, then "figbloom" with the glyph again (orange)
// as its g, and "FLEET" spread in small letters underneath, the same width.
// "dark" is for white backgrounds, "light" for dark ones (as BrandIcon).
export default function BrandWordmark({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const text = variant === "dark" ? "text-teal-950" : "text-white";
  const sub = variant === "dark" ? "text-teal-600" : "text-teal-200";

  return (
    <span className={`inline-flex items-center gap-2 ${text}`} aria-label="FIGBLOOM FLEET" role="img">
      <BrandIcon variant={variant} className="h-8 w-8" />
      <span aria-hidden="true" className="inline-flex flex-col leading-none">
        {/* Plain inline text so the g sits on the baseline like a letter. */}
        <span className="whitespace-nowrap text-xl font-extrabold tracking-tight">
          fi
          <GlyphG />
          bloom
        </span>
        <span className={`mt-1 flex justify-between text-[9px] font-semibold ${sub}`}>
          {"FLEET".split("").map((letter, i) => (
            <span key={i}>{letter}</span>
          ))}
        </span>
      </span>
    </span>
  );
}
