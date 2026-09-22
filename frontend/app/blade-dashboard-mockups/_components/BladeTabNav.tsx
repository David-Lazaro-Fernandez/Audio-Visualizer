"use client";

import { useEffect } from "react";
import { tabGeometry } from "./blade-curve";
import { TAB_WIDTH, tabMirrored, tabTopX } from "./blade-layout";
import { bladeTransition } from "./blade-motion";
import { useBladeNav, type BladeSection } from "./BladeNavContext";
import { playSound, preloadSounds } from "./sounds";

/**
 * DESIGN.md §1: the collapsed blades are the top-level navigation, as
 * narrow curved vertical tabs with rotated text labels. Thus this is a
 * real menu. Each tab is an <li><button> whose clickable area is the
 * curved silver shape of the tab, and not a text label above an
 * unrelated decoration. The shape is a plain <div> clipped with
 * `clip-path: polygon(...)` from `tabGeometry`, sampled from the same
 * bezier curve that `BladeEdges` uses for the panel. There is no <svg>.
 *
 * The position of each tab comes from its index and from the open blade
 * (`tabTopX` and `tabMirrored` in `blade-layout.ts`, §1.2). The tabs up
 * to and including the open blade fan to the left of the panel and are
 * mirrored, which bows right and flares left. The other tabs fan to the
 * right. Thus a blade switch deals the hand again: the panel slides and
 * the tabs regroup and glide to their new positions at the shared blade
 * tempo (§7.4). The box transitions `left` and `width`, and the shape
 * transitions `clip-path`, because the curve mirrors when a tab moves to
 * the other stack.
 *
 * The nav is one full-width layer (`inset-0`) above the content layer,
 * z-20 against z-10, and it is not divided by side.
 * `pointer-events-none` on the layer keeps its empty space out of the
 * hit test, thus it does not take a click that belongs to the content
 * below. Only the tab `<li>` elements take pointer events again, with
 * `pointer-events-auto`.
 *
 * The blades and the index of the open blade are in `BladeNavContext`,
 * which the Left and Right handling in `KeyboardNav` also uses. A click
 * on a tab, or Space or A on a focused tab, opens that blade and plays
 * Page Right or Page Left by direction. A hover on a tab plays Select.
 * The active tab uses the fill of its section (§2.1) and the other tabs
 * are neutral silver (§2.3).
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
            // The shape glides at the blade tempo. The hover brightness
            // keeps the usual 150 ms (§7.1).
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
