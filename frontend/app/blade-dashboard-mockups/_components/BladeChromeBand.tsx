/**
 * The header and button-legend bands of a blade sit on a darker tint of
 * the section color rather than a solid fill — DESIGN.md §5.2 calls this
 * out as a "darker header band". Implemented as a transparent black
 * overlay (not an opaque color) so the section's own gradient/sheen still
 * shows through, just dimmed. The corners facing the main content are
 * rounded off (25px) instead of a hard border, reading as the seam
 * between the two.
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
