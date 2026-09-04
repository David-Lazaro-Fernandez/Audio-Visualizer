"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { pageTurnSound, playSound } from "./sounds";

/**
 * Which blade is open. Lives above both the tab strip (`BladeTabNav`) and
 * the global key handler (`KeyboardNav`) so clicking a tab and pressing
 * Left/Right anywhere on the page drive the same index. Blade order is the
 * tab order, left to right; the page seeds `initialIndex` from whichever
 * tab is flagged `active` (games, index 2).
 *
 * `goTo` plays Page Right when moving to a higher index and Page Left for a
 * lower one, and nothing when the index doesn't change (already at the end,
 * or re-selecting the open blade).
 */
export interface BladeNavValue {
  activeIndex: number;
  count: number;
  goTo: (index: number) => void;
  /** Move `delta` blades; clamps at both ends. */
  step: (delta: number) => void;
}

const BladeNavContext = createContext<BladeNavValue | null>(null);

export function BladeNavProvider({
  count,
  initialIndex = 0,
  children,
}: {
  count: number;
  initialIndex?: number;
  children: React.ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const goTo = useCallback(
    (index: number) => {
      const next = Math.min(count - 1, Math.max(0, index));
      const cue = pageTurnSound(activeIndex, next);
      if (cue) playSound(cue);
      setActiveIndex(next);
    },
    [activeIndex, count],
  );

  const step = useCallback(
    (delta: number) => goTo(activeIndex + delta),
    [goTo, activeIndex],
  );

  const value = useMemo(
    () => ({ activeIndex, count, goTo, step }),
    [activeIndex, count, goTo, step],
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
