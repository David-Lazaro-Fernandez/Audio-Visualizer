"use client";

import { useBladeNav } from "./BladeNavContext";
import { DEFAULT_ACTIVE_INDEX, panelClipPath } from "./blade-layout";
import { BLADE_MOTION_MS, bladeTransition } from "./blade-motion";
import { gradientCss } from "./blade-gradient";
import { useBladeSurfacePainted } from "./BladeSurface";

/**
 * DESIGN.md §1.1: the active panel's own waisted/flared boundary (never a
 * rectangle) plus its specular gloss — a plain <div> clipped to the curve
 * with `clip-path: polygon(...)` rather than an <svg>/<path>. The
 * collapsed tabs are NOT drawn here — each one is its own self-contained
 * shape inside `BladeTabNav`'s buttons, since a tab is a menu item and its
 * clickable area has to be the actual curved shape.
 *
 * The panel slides with the open blade (§1.2, §7.4): its edges come from
 * `BladeNavContext` and the clip-path transitions between blades, so the
 * panel visibly glides to its new edges.
 *
 * What fills the shape depends on who is painting. When the WebGL surface
 * is live (`BladeSurface`) it has already drawn the section gradient, the
 * sheen and the gloss underneath, masked to this same curve — so this
 * keeps only the 2.5 px rim, which has to stay in CSS because it follows
 * the clip-path exactly. On the CSS fallback the shape carries its own
 * gradient and gloss, and the §7.4 color change has to be faked, because
 * CSS cannot interpolate two gradients: the previous blade's color is
 * painted on top and faded out (`blade-fade-out`, keyed on the open blade
 * so each switch restarts it). Reduced-motion users get the cut.
 */
/** The panel curve with the default (games) blade open, for reference. */
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
      {/* specular gloss overlay on the active panel */}
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
