import Image from "next/image";

/**
 * DESIGN.md §6.7 media slot, filled: the grey Xbox LIVE tile. A branded
 * header, not a row, so it isn't a nav item and the cursor skips it. Uses
 * the 2005 logo artwork on a flat #616063 (§2.3 "branded tiles") with the
 * same inner shadow and light rim as the raised rows. The Games Library
 * stacks it above its menu; the Xbox LIVE blade shows it under the
 * "Connect" row with `rings`, the faint concentric LIVE arcs fading in
 * from the left edge, as the console's ad tile did.
 */
export function XboxLiveBanner({
  rings = false,
  className,
}: {
  rings?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative flex h-[92px] items-center justify-center overflow-hidden rounded-[10px] bg-[#616063] ${className ?? ""}`}
      style={{
        boxShadow:
          "inset 0 0 10px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.55)",
      }}
    >
      {rings && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[45%]"
          style={{
            background:
              "repeating-radial-gradient(circle at 12% 50%, rgba(140,200,60,0) 0 13px, rgba(140,200,60,.5) 13px 16px, rgba(140,200,60,0) 16px 30px)",
            maskImage: "linear-gradient(90deg, #000 20%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(90deg, #000 20%, transparent 100%)",
          }}
        />
      )}
      <Image
        src="/assets/Xbox-Live-Logo-2005.png"
        alt="Xbox LIVE"
        width={2000}
        height={1125}
        className="relative h-[64px] w-auto"
        priority
      />
    </div>
  );
}
