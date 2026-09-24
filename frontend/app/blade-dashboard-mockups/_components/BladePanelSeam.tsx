"use client";

import { useBladeNav } from "./BladeNavContext";
import { CANVAS_HEIGHT, edgeSvgPathD } from "./blade-curve";
import { pctX, TAB_WIDTH } from "./blade-layout";
import { bladeTransition } from "./blade-motion";

/**
 * Local top-x each path is traced at, standing in for the real edge
 * (`0` in `edgeSvgPathD` terms) so the curve's own bow/flare excursion —
 * up to ±76.5 reference px (§1.1's deltas, scaled) — never goes negative
 * inside the small viewBox below. Only the element's position (`left`)
 * needs the current blade's edge added at render time, exactly as the
 * old clip-path band did.
 */
const LEFT_SEAM_LOCAL_X = 80;
const RIGHT_SEAM_LOCAL_X = 20;
/** Wide enough to hold either curve's own local excursion with margin for the stroke's blur to bleed into. */
const SEAM_VIEW_WIDTH = 120;

const LEFT_SEAM_PATH_D = edgeSvgPathD(LEFT_SEAM_LOCAL_X, true);
const RIGHT_SEAM_PATH_D = edgeSvgPathD(RIGHT_SEAM_LOCAL_X, false);

/**
 * A soft dark shadow along the open panel's own two curved edges
 * (DESIGN.md §1.1), just inside its boundary — the same idea as the Sign
 * In drawer's seam stroke (§6.22: a fade rather than a hard line) and,
 * unlike an earlier version of this component, drawn the same way: a
 * real SVG `<path>` traced along the curve (`edgeSvgPathD`) with a
 * blurred stroke, not a `linear-gradient` painted across a clipped box.
 *
 * The earlier version anchored its gradient's fade stops to the curve's
 * position at the *top* of the panel (y=0) and then painted that same
 * flat, unmoving gradient down the whole height. That is fine while the
 * band is wide enough to roughly cover the curve's total horizontal
 * excursion, but this edge bows and flares by close to 100 reference px
 * top to bottom (§1.1) while the seam itself is meant to read as only a
 * few px wide — so once the band was narrowed to satisfy that, most of
 * the panel's height fell entirely outside the fixed gradient's two
 * stops and rendered as flat opaque or flat transparent, a hard-edged
 * cut rather than a fade. A path stroke has no such box to fall out of:
 * it is drawn *at* the curve at every y, so the seam tracks the bow and
 * flare exactly, and the blur is what turns the line into a fade.
 *
 * It is a sibling of `BladeEdges`, not a part of it, purely decorative
 * (`pointer-events-none`) and never a cursor stop. Unlike the drawer's
 * own seam stroke, this one is not confined by any `clip-path` — the
 * `<svg>` here carries only the path, not the panel's own fill — so
 * nothing clips its blur, and, unlike the drawer's stroke, this one
 * still has to track the open blade and slide at the shared blade tempo
 * (§7.4). The curve's own shape does not change between blades (the
 * left family is always mirrored and the right family never is,
 * §1.2), so only `left` transitions; the path itself is computed once.
 *
 * **The left seam sits at `geometry.leftX - TAB_WIDTH`, not `geometry.leftX`.**
 * `BladeTabNav` gives the open blade its own tab, in the left stack,
 * painted in the same `tabFill` green as the panel (§6.1: it is marked
 * `aria-current="page"`, a real part of the design and not a stray
 * artifact) — so the open blade's *true* outer edge, where the green
 * meets the neutral tab beside it, is one tab-width left of the panel's
 * own nominal edge. `geometry.leftX` is the boundary between the active
 * tab and the panel, which are the same colour, so a seam drawn there
 * cuts a visible crack through the middle of what should read as one
 * continuous shape instead of tracing its actual perimeter. The right
 * edge has no such neighbour — every tab past the open blade sits in
 * the right stack — so `geometry.rightX` is already the true edge there.
 *
 * **`z-[25]`, above `BladeTabNav`'s `z-20`.** Both seams sit exactly
 * where a tab's own curved shape is — that boundary is the entire point
 * of a seam — and a tab is opaque, so with no z-index of its own (the
 * default, stacking at the same level as `BladeEdges` and
 * `BladeBackground`, both far below `z-20`) the tab painted over the
 * seam completely and it was invisible at every zoom level, which is
 * why it went unnoticed until an actual screenshot of the running page
 * was checked. `pointer-events-none` keeps the seam from covering the
 * tab's own hit target even though it now paints on top of it.
 */
export function BladePanelSeam() {
  const { geometry } = useBladeNav();
  const transition = bladeTransition("left");
  const leftEdgeX = geometry.leftX - TAB_WIDTH;

  return (
    <>
      <svg
        aria-hidden="true"
        className="blade-motion pointer-events-none absolute inset-y-0 z-[25]"
        style={{
          left: `${pctX(leftEdgeX - LEFT_SEAM_LOCAL_X)}%`,
          width: `${pctX(SEAM_VIEW_WIDTH)}%`,
          overflow: "visible",
          transition,
        }}
        height="100%"
        viewBox={`0 0 ${SEAM_VIEW_WIDTH} ${CANVAS_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path
          d={LEFT_SEAM_PATH_D}
          fill="none"
          stroke="rgba(62,62,62,.7)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(2px)" }}
        />
      </svg>
      <svg
        aria-hidden="true"
        className="blade-motion pointer-events-none absolute inset-y-0 z-[25]"
        style={{
          left: `${pctX(geometry.rightX - RIGHT_SEAM_LOCAL_X)}%`,
          width: `${pctX(SEAM_VIEW_WIDTH)}%`,
          overflow: "visible",
          transition,
        }}
        height="100%"
        viewBox={`0 0 ${SEAM_VIEW_WIDTH} ${CANVAS_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path
          d={RIGHT_SEAM_PATH_D}
          fill="none"
          stroke="rgba(62,62,62,.7)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(2px)" }}
        />
      </svg>
    </>
  );
}
