"use client";

import { useEffect } from "react";
import { tabGeometry } from "./blade-curve";
import { useBladeNav } from "./BladeNavContext";
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
 * `topLeftX`/`topRightX` are the tab's edges at the top of the 1280-wide
 * reference canvas that `BladeEdges` also uses for the panel — see
 * `blade-curve.ts` for how the curve bows/flares from there. `mirrored`
 * picks which side of the stack the tab bows toward (true = left-stack:
 * bows right then flares left; false = right-stack: bows left then flares
 * right).
 *
 * The whole nav is one full-width (`inset-0`) layer stacked above the
 * content layer (z-20 vs. the content's z-10) rather than being split per
 * side — but `pointer-events-none` on the layer means its empty space
 * never hit-tests, so it doesn't swallow clicks meant for the content
 * underneath. Only the tab `<li>`s themselves opt back in with
 * `pointer-events-auto`.
 *
 * The "which blade am I on" index lives in `BladeNavContext`, shared with
 * the Left/Right arrow handling in `KeyboardNav`. Clicking a tab (or
 * pressing Space/A on a focused one) goes to that blade, which plays Page
 * Right / Page Left by direction; hovering any tab plays Select.
 */
export interface BladeTab {
  label: string;
  topLeftX: number;
  topRightX: number;
  mirrored: boolean;
  /** Marks the blade that's open on load; the page feeds it to `BladeNavProvider`. */
  active?: boolean;
}

const SILVER_FILL = "linear-gradient(90deg,#a9a9a9,#fbfbfb 30%,#dcdcdc 62%,#b6b6b6)";
const ACTIVE_FILL = "linear-gradient(90deg,#478f14,#95e04d 35%,#57a91b)";

export function BladeTabNav({ tabs }: { tabs: BladeTab[] }) {
  const { activeIndex, goTo } = useBladeNav();

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
          {tabs.map((tab, index) => (
            <TabItem
              key={tab.label}
              {...tab}
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
  label,
  topLeftX,
  topRightX,
  mirrored,
  active,
  onSelect,
}: BladeTab & { onSelect: () => void }) {
  const geom = tabGeometry(topLeftX, topRightX, mirrored);

  return (
    <li
      className="pointer-events-auto absolute inset-y-0"
      style={{ left: `${geom.leftPct}%`, width: `${geom.widthPct}%` }}
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
          className="absolute inset-0 h-full w-full transition group-hover:brightness-110 group-focus-visible:brightness-110"
          style={{
            clipPath: geom.clipPath,
            background: active ? ACTIVE_FILL : SILVER_FILL,
            filter: "drop-shadow(0 0 1px rgba(255,255,255,.85))",
          }}
        />
        <span
          style={{ writingMode: "vertical-rl" }}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] transition-colors duration-150 ${
            active
              ? "text-[#1e3d08] group-hover:text-black group-focus-visible:text-black"
              : "text-[#7d7d7d] group-hover:text-white group-focus-visible:text-white"
          }`}
        >
          {label}
        </span>
      </button>
    </li>
  );
}
