/**
 * The full-bleed blade surface (DESIGN.md §1: "the entire top-level UI ...
 * expands to fill the center of the screen"). Owns the section's signature
 * radial-gradient background color (§2.1) and clips everything else to it.
 */
export function BladeCanvas({
  background,
  children,
}: {
  background: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative h-screen w-full overflow-hidden rounded-[6px]"
      style={{ background }}
    >
      {children}
    </div>
  );
}
