import { bandClipPath } from "./blade-curve";

/**
 * DESIGN.md §1.1: the active panel's own waisted/flared boundary (never a
 * rectangle) plus its specular gloss — a plain <div> clipped to the curve
 * with `clip-path: polygon(...)` rather than an <svg>/<path>. The
 * collapsed tabs are NOT drawn here — each one is its own self-contained
 * shape inside `BladeTabNav`'s buttons, since a tab is a menu item and its
 * clickable area has to be the actual curved shape.
 */
// The panel straddles both curve families: its left edge bows/flares like
// the left-stack tabs, its right edge like the right-stack ones.
export const PANEL_CLIP_PATH = bandClipPath(292, 1000, true, false);

export function BladeEdges() {
  return (
    <div
      className="absolute inset-0 h-full w-full"
      style={{
        clipPath: PANEL_CLIP_PATH,
        background: "radial-gradient(90% 80% at 50% 44%, #6ecb2e 0%, #52b81f 30%, #3e9c16 62%, #2f7e10 100%)",
        boxShadow: "inset 0 0 0 2.5px rgba(240,240,240,.7)",
      }}
    >
      {/* specular gloss overlay on the active panel */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.05) 45%, rgba(255,255,255,0))",
        }}
      />
    </div>
  );
}
