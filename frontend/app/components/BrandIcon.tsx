// The Fig Fleet glyph used wherever the brand mark appears next to the
// wordmark. "light" (white fill) is for dark/colored backgrounds — sidebar,
// the login/register hero overlay. "dark" (teal fill) is for white
// backgrounds, where a white glyph would be invisible.
export default function BrandIcon({
  variant = "light",
  className = "h-5 w-5",
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const src = variant === "dark" ? "/brand/figfleet-icon-dark.png" : "/brand/figfleet-icon.png";
  return <img src={src} alt="" aria-hidden="true" className={`${className} object-contain`} />;
}
