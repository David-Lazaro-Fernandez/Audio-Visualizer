/**
 * The shadow set of the content band that sits between two chrome bands
 * on a full-screen menu surface (DESIGN.md §5.4). The band is above the
 * chrome, with the content at `z-10` and the chrome at `z-0`, and it
 * looks like a raised slab:
 *
 * - Two inset shadows, from the Figma reference (node 158:5). They are a
 *   pale grey (#d9d9d9) that fades from 30% at the top edge and the
 *   bottom edge to 0% at the centre. Thus the band looks lit at the two
 *   seams.
 * - Two outer shadows, dark, that fall up onto the header and down onto
 *   the legend. Thus the chrome bands look like they are below the
 *   content.
 */
export const CONTENT_BAND_SHADOW = [
  "inset 0 140px 120px -80px rgba(217,217,217,.3)",
  "inset 0 -140px 120px -80px rgba(217,217,217,.3)",
  "rgba(0, 0, 0, 0.35) 0px -2px 15px",
  "rgba(0, 0, 0, 0.35) 0px 2px 15px",
].join(", ");

/**
 * The header band and the button-legend band of a blade. They sit on a
 * darker tint of the section colour and not on a solid fill (DESIGN.md
 * §5.2: a darker header band). The band is a transparent black overlay
 * and not an opaque colour, thus the gradient and the sheen of the
 * section still show and are only darker. The corners that face the main
 * content have a 25 px radius and no hard border, thus they read as the
 * seam between the band and the content.
 */
export function BladeChromeBand({
  edge,
  className,
  children,
}: {
  edge: "top" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  const roundedCorners = edge === "top" ? "rounded-b-[25px]" : "rounded-t-[25px]";

  return (
    <div className={`${roundedCorners} bg-black/10 ${className ?? ""}`}>
      {children}
    </div>
  );
}
