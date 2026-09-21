"use client";

import { useEffect } from "react";
import { tabGeometry } from "./blade-curve";
import { TAB_WIDTH, tabMirrored, tabTopX } from "./blade-layout";
import { bladeTransition } from "./blade-motion";
import { useBladeNav, type BladeSection } from "./BladeNavContext";
import { playSound, preloadSounds } from "./sounds";

/**
 * DESIGN.md §1: the collapsed blades ARE the top-level navigation — "narrow,
 * curved vertical tabs... labeled with rotated text." That makes this a
 * real menu, so each tab is an <li><button> whose clickable area is the
 * tab's own curved silver shape (a plain <div> clipped with `clip-path:
 * polygon(...)` via `tabGeometry`, sampled from the same bezier curve
 * `BladeEdges` uses for the panel — no <svg> involved), not just a
 * floating text label sitting over an unrelated decorative element.
 *
 * Where each tab sits follows from its index and the open blade
 * (`tabTopX` / `tabMirrored` in `blade-layout.ts`, §1.2): tabs up to and
 * including the open one fan to the left of the panel and are mirrored
 * (bow right, flare left); the rest fan to the right. Switching blades
 * therefore re-deals the hand — the panel slides and the tabs regroup,
 * gliding to their new spots at the shared blade tempo (§7.4): `left` /
 * `width` on the box and `clip-path` on the shape (the curve flips when a
 * tab crosses from one stack to the other).
 *
 * The whole nav is one full-width (`inset-0`) layer stacked above the
 * content layer (z-20 vs. the content's z-10) rather than being split per
 * side — but `pointer-events-none` on the layer means its empty space
 * never hit-tests, so it doesn't swallow clicks meant for the content
 * underneath. Only the tab `<li>`s themselves opt back in with
 * `pointer-events-auto`.
 *
 * The blades and the "which blade am I on" index live in
 * `BladeNavContext`, shared with the Left/Right arrow handling in
 * `KeyboardNav`. Clicking a tab (or pressing Space/A on a focused one) goes
 * to that blade, which plays Page Right / Page Left by direction; hovering
 * any tab plays Select. The active tab wears its section's fill (§2.1);
 * the rest are neutral silver (§2.3).
 */
const SILVER_FILL = "linear-gradient(90deg,#a9a9a9,#fbfbfb 30%,#dcdcdc 62%,#b6b6b6)";

export function BladeTabNav() {
  const { blades, activeIndex, goTo } = useBladeNav();

  useEffect(() => {
    preloadSounds();
  }, []);

  return (
    <aside
      aria-label="Blade sections"
      className="pointer-events-none absolute inset-0 z-20"
    >
      <nav>
        <ul>
          {blades.map((blade, index) => (
            <TabItem
              key={blade.label}
              blade={blade}
              topLeftX={tabTopX(index, activeIndex)}
              mirrored={tabMirrored(index, activeIndex)}
              active={index === activeIndex}
              onSelect={() => goTo(index)}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function TabItem({
  blade,
  topLeftX,
  mirrored,
  active,
  onSelect,
}: {
  blade: BladeSection;
  topLeftX: number;
  mirrored: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const geom = tabGeometry(topLeftX, topLeftX + TAB_WIDTH, mirrored);

  return (
    <li
      className="blade-motion pointer-events-auto absolute inset-y-0"
      style={{
        left: `${geom.leftPct}%`,
        width: `${geom.widthPct}%`,
        transition: bladeTransition("left", "width"),
      }}
    >
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        data-nav-item
        onMouseEnter={() => playSound("select")}
        onClick={onSelect}
        className="group relative block h-full w-full cursor-pointer focus-visible:outline-none"
      >
        <div
          className="blade-motion absolute inset-0 h-full w-full group-hover:brightness-110 group-focus-visible:brightness-110"
          style={{
            clipPath: geom.clipPath,
            background: active ? blade.tabFill : SILVER_FILL,
            filter: "drop-shadow(0 0 1px rgba(255,255,255,.85))",
            // Shape glides at the blade tempo; the hover brightness keeps
            // the usual 150 ms (§7.1).
            transition: `${bladeTransition("clip-path")}, filter 150ms ease`,
          }}
        />
        <span
          style={{ writingMode: "vertical-rl" }}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] transition-colors duration-150 ${
            active
              ? "text-(--blade-ink) group-hover:text-black group-focus-visible:text-black"
              : "text-[#7d7d7d] group-hover:text-white group-focus-visible:text-white"
          }`}
        >
          {blade.label}
        </span>
      </button>
    </li>
  );
}
