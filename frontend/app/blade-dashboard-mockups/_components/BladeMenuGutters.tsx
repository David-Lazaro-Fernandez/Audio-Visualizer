"use client";

import { useBladeNav } from "./BladeNavContext";
import { bladeTransition } from "./blade-motion";

const GUTTER_FILL = "linear-gradient(180deg,#c9c9c9,#ececec 45%,#c4c4c4)";

/**
 * The collapsed tab stack sits on a neutral gray field and not on the
 * colour of the active section (DESIGN.md §2.3: only the colour of the
 * active section is saturated). This component is behind BladeEdges,
 * with the same absolute position, and it stops exactly at the edges of
 * the panel. Thus it covers only the tab area and never the active
 * content in the centre. The edges follow the open blade (§1.2), thus
 * the gutters become wider and narrower as the panel moves, at the
 * shared blade tempo (§7.4).
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
