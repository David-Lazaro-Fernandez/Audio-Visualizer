"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { panelGeometry, type PanelGeometry } from "./blade-layout";
import type { SectionGradient } from "./blade-gradient";
import type { BladeTheme } from "./blade-theme";
import { pageTurnSound, playSound } from "./sounds";

/**
 * One top-level blade (DESIGN.md §1): its tab label, its panel title and
 * its section identity (§2.1). The identity is the radial gradient, the
 * fill of the active tab, and the text and rule tints that the shared
 * components read as CSS variables. The gradient is data and not a CSS
 * string, because the WebGL surface needs its stops as numbers
 * (`blade-gradient.ts`). `gradientCss` makes the CSS fallback from the
 * same data.
 *
 * The position is not here. The position of a tab and the position of
 * the panel both come from the index of the blade and from the open
 * blade (`blade-layout.ts`).
 */
export interface BladeSection {
  label: string;
  title: string;
  gradient: SectionGradient;
  tabFill: string;
  theme: BladeTheme;
}

/**
 * Which blade is open. The context is above the tab strip
 * (`BladeTabNav`), the global key handler (`KeyboardNav`) and each part
 * of the chrome (`BladeEdges`, `BladeMenuGutters`, `BladeBackground`,
 * `BladePanel`). Thus a click on a tab and a press of Left or Right at
 * each position on the page drive the same index, and the panel, the
 * gutters and the section colour move together. The blade order is the
 * order of `blades`, left to right. The page sets `initialIndex`, which
 * is games, index 2, by default.
 *
 * `goTo` plays Page Right for a move to a higher index and Page Left for
 * a move to a lower index. It plays nothing when the index does not
 * change, which occurs at an end of the list or on the open blade. It
 * also records the blade that the user left and the direction of the
 * move. The transition (§7.4) uses those two values to fade the old
 * colour off the panel and to slide the new content in from the correct
 * side.
 */
export interface BladeNavValue {
  blades: BladeSection[];
  activeIndex: number;
  /** The open blade. */
  active: BladeSection;
  /** The blade that was open before the last switch. It is null until the first switch. */
  previous: BladeSection | null;
  /** +1 when the last switch moved right, -1 for left, and 0 before the first switch. */
  direction: -1 | 0 | 1;
  /** The position of the panel of the open blade on the reference frame. */
  geometry: PanelGeometry;
  count: number;
  goTo: (index: number) => void;
  /** Moves `delta` blades. It clamps at the two ends. */
  step: (delta: number) => void;
}

const BladeNavContext = createContext<BladeNavValue | null>(null);

export function BladeNavProvider({
  blades,
  initialIndex = 0,
  children,
}: {
  blades: BladeSection[];
  initialIndex?: number;
  children: React.ReactNode;
}) {
  const count = blades.length;
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);

  const goTo = useCallback(
    (index: number) => {
      const next = Math.min(count - 1, Math.max(0, index));
      if (next === activeIndex) return;
      const cue = pageTurnSound(activeIndex, next);
      if (cue) playSound(cue);
      setPreviousIndex(activeIndex);
      setActiveIndex(next);
    },
    [activeIndex, count],
  );

  const step = useCallback(
    (delta: number) => goTo(activeIndex + delta),
    [goTo, activeIndex],
  );

  const value = useMemo<BladeNavValue>(
    () => ({
      blades,
      activeIndex,
      active: blades[activeIndex],
      previous: previousIndex === null ? null : blades[previousIndex],
      direction:
        previousIndex === null ? 0 : activeIndex > previousIndex ? 1 : -1,
      geometry: panelGeometry(activeIndex),
      count,
      goTo,
      step,
    }),
    [blades, activeIndex, previousIndex, count, goTo, step],
  );

  return <BladeNavContext.Provider value={value}>{children}</BladeNavContext.Provider>;
}

export function useBladeNav(): BladeNavValue {
  const ctx = useContext(BladeNavContext);
  if (!ctx) {
    throw new Error("useBladeNav must be used inside <BladeNavProvider>");
  }
  return ctx;
}
