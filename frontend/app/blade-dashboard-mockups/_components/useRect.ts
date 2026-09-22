import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface MeasuredRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function measure(el: Element): MeasuredRect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  };
}

/**
 * Tracks the box of an element relative to the viewport, with a
 * ResizeObserver and scroll and resize listeners. Thus the layout code
 * can use the true pixel size and position and does not assume fixed
 * coordinates.
 */
export function useRect<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [rect, setRect] = useState<MeasuredRect | null>(null);

  const remeasure = useCallback(() => {
    if (ref.current) setRect(measure(ref.current));
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(el);
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [remeasure]);

  return { ref, rect, remeasure };
}
