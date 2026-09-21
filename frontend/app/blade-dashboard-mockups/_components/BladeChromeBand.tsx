/**
 * The header and button-legend bands of a blade sit on a darker tint of
 * the section color rather than a solid fill — DESIGN.md §5.2 calls this
 * out as a "darker header band". Implemented as a transparent black
 * overlay (not an opaque color) so the section's own gradient/sheen still
 * shows through, just dimmed. The corners facing the main content are
 * rounded off (25px) instead of a hard border, reading as the seam
 * between the two.
 */
/**
 * Shadow set for the content band that sits between two chrome bands on
 * full-screen menu surfaces (DESIGN.md §5.4). The band is stacked above the
 * chrome (content `z-10`, chrome `z-0`) and treated as a raised slab:
 *
 * - Two inset, from the Figma reference (Basurero de memes, node 158:5): a
 *   pale grey (#d9d9d9) fading from 30% at the top and bottom edges to 0%
 *   at the centre — the band reads as lit along both seams.
 * - Two outer, dark, cast upward onto the header and downward onto the
 *   legend, so the chrome bands look tucked beneath the content.
 */
export const CONTENT_BAND_SHADOW = [
  "inset 0 140px 120px -80px rgba(217,217,217,.3)",
  "inset 0 -140px 120px -80px rgba(217,217,217,.3)",
  "rgba(0, 0, 0, 0.35) 0px -2px 15px",
  "rgba(0, 0, 0, 0.35) 0px 2px 15px",
].join(", ");

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
