"use client";

import { createContext, useContext } from "react";
import { useRect, type MeasuredRect } from "./useRect";

const MenuBoundaryContext = createContext<MeasuredRect | null>(null);

/** The container box that a detail box must stay inside (refer to `placeMenuBox`). */
export function useMenuBoundary() {
  return useContext(MenuBoundaryContext);
}

/**
 * Wraps the main content container and measures its pixel box. Thus a
 * menu below it knows how much space it has for a detail box.
 */
export function MenuBoundary({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { ref, rect } = useRect<HTMLDivElement>();

  return (
    <div ref={ref} className={className} style={style}>
      <MenuBoundaryContext.Provider value={rect}>
        {children}
      </MenuBoundaryContext.Provider>
    </div>
  );
}
