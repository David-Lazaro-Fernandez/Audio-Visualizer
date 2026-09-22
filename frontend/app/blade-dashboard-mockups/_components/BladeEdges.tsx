"use client";

import { useBladeNav } from "./BladeNavContext";
import { DEFAULT_ACTIVE_INDEX, panelClipPath } from "./blade-layout";
import { BLADE_MOTION_MS, bladeTransition } from "./blade-motion";
import { gradientCss } from "./blade-gradient";
import { useBladeSurfacePainted } from "./BladeSurface";

/**
 * DESIGN.md §1.1: the waisted and flared boundary of the active panel,
 * which is never a rectangle, with its specular gloss. It is a plain
 * <div> clipped to the curve with `clip-path: polygon(...)` and not an
 * <svg> or a <path>. This component does not draw the collapsed tabs.
 * Each tab is its own shape in a button of `BladeTabNav`, because a tab
 * is a menu item and its clickable area must be the curved shape.
 *
 * The panel moves with the open blade (§1.2, §7.4). Its edges come from
 * `BladeNavContext` and the clip-path transitions between blades, thus
 * the panel glides to its new edges.
 *
 * The fill of the shape depends on the painter. When the WebGL surface
 * is live (`BladeSurface`), it already drew the section gradient, the
 * sheen and the gloss below, with a mask on this same curve. Thus this
 * component keeps only the 2.5 px rim, which must stay in CSS because it
 * follows the clip-path exactly. On the CSS fallback the shape carries
 * its own gradient and gloss, and the colour change of §7.4 needs a
 * substitute, because CSS cannot interpolate two gradients: the code
 * paints the colour of the previous blade on top and fades it out
 * (`blade-fade-out`, keyed on the open blade, thus each switch starts it
 * again). A user with reduced motion gets a cut.
 */
/** The panel curve with the default blade, games, open. It is a reference value. */
export const PANEL_CLIP_PATH = panelClipPath(DEFAULT_ACTIVE_INDEX);

export function BladeEdges() {
  const { active, activeIndex, previous, geometry } = useBladeNav();
  const painted = useBladeSurfacePainted();
  return (
    <div
      className="blade-motion absolute inset-0 h-full w-full"
      style={{
        clipPath: geometry.clipPath,
        background: painted ? undefined : gradientCss(active.gradient),
        boxShadow: "inset 0 0 0 2.5px rgba(240,240,240,.7)",
        transition: bladeTransition("clip-path"),
      }}
    >
      {!painted && previous && (
        <div
          key={activeIndex}
          aria-hidden="true"
          className="absolute inset-0 motion-reduce:hidden"
          style={{
            background: gradientCss(previous.gradient),
            animation: `blade-fade-out ${BLADE_MOTION_MS}ms ease-out forwards`,
          }}
        />
      )}
      {/* The specular gloss above the active panel. */}
      {!painted && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.05) 45%, rgba(255,255,255,0))",
          }}
        />
      )}
    </div>
  );
}
