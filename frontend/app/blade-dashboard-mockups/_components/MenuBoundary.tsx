"use client";

import { createContext, useContext } from "react";
import { useRect, type MeasuredRect } from "./useRect";

const MenuBoundaryContext = createContext<MeasuredRect | null>(null);

/** The container box that detail boxes must stay within (see `placeMenuBox`). */
export function useMenuBoundary() {
  return useContext(MenuBoundaryContext);
}

/**
 * Wraps the main content container and tracks its real pixel box, so
 * descendant menus know how much room they have to open a detail box in
 * before they run out of container.
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
