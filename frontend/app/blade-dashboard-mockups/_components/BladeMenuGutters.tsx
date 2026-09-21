"use client";

import { useBladeNav } from "./BladeNavContext";
import { bladeTransition } from "./blade-motion";

const GUTTER_FILL = "linear-gradient(180deg,#c9c9c9,#ececec 45%,#c4c4c4)";

/**
 * The collapsed tab stack sits on a neutral gray field, not the active
 * section's color (DESIGN.md §2.3: "only the active section's color is
 * saturated"). This sits behind BladeEdges, absolutely positioned like it,
 * and stops exactly at the panel's edges so it only reaches the menu
 * (tab) area — never the active content in the center. The edges follow
 * the open blade (§1.2), so the gutters widen and narrow as the panel
 * slides, at the shared blade tempo (§7.4).
 */
export function BladeMenuGutters() {
  const { geometry } = useBladeNav();
  const style = { background: GUTTER_FILL, transition: bladeTransition("width") };
  return (
    <>
      <div
        className="absolute inset-y-0 left-0 opacity-95 blade-motion"
        style={{ ...style, width: `${geometry.leftPct}%` }}
      />
      <div
        className="absolute inset-y-0 right-0 opacity-95 blade-motion"
        style={{ ...style, width: `${geometry.rightInsetPct}%` }}
      />
    </>
  );
}
