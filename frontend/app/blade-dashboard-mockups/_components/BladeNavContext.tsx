"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { panelGeometry, type PanelGeometry } from "./blade-layout";
import type { SectionGradient } from "./blade-gradient";
import type { BladeTheme } from "./blade-theme";
import { pageTurnSound, playSound } from "./sounds";

/**
 * One top-level blade (DESIGN.md §1): its tab label, panel title, and
 * section identity (§2.1) — the radial gradient, the active-tab fill and
 * the text/rule tints the shared components read as CSS variables. The
 * gradient is carried as data rather than a CSS string because the WebGL
 * surface needs its stops as numbers (`blade-gradient.ts`); `gradientCss`
 * derives the CSS fallback from the same source.
 * Position is not stored here: where a tab sits, and where the panel is,
 * both follow from the blade's index and which blade is open
 * (`blade-layout.ts`).
 */
export interface BladeSection {
  label: string;
  title: string;
  gradient: SectionGradient;
  tabFill: string;
  theme: BladeTheme;
}

/**
 * Which blade is open. Lives above the tab strip (`BladeTabNav`), the
 * global key handler (`KeyboardNav`) and all the chrome (`BladeEdges`,
 * `BladeMenuGutters`, `BladeBackground`, `BladePanel`), so clicking a tab
 * and pressing Left/Right anywhere on the page drive the same index, and
 * the panel, gutters and section color all move together. Blade order is
 * the `blades` order, left to right; the page seeds `initialIndex`
 * (games, index 2, by default).
 *
 * `goTo` plays Page Right when moving to a higher index and Page Left for a
 * lower one, and nothing when the index doesn't change (already at the end,
 * or re-selecting the open blade). It also records the blade just left and
 * the direction of travel, which the transition (§7.4) uses to crossfade
 * the old color off the panel and slide the new content in from the right
 * side.
 */
export interface BladeNavValue {
  blades: BladeSection[];
  activeIndex: number;
  /** The open blade. */
  active: BladeSection;
  /** The blade open before the last switch; null until the first switch. */
  previous: BladeSection | null;
  /** +1 when the last switch moved right, -1 left, 0 before any switch. */
  direction: -1 | 0 | 1;
  /** Where the open blade's panel is on the reference frame. */
  geometry: PanelGeometry;
  count: number;
  goTo: (index: number) => void;
  /** Move `delta` blades; clamps at both ends. */
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
