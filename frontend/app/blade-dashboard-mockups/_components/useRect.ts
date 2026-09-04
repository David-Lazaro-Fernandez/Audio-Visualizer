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
 * Tracks an element's viewport-relative box (via ResizeObserver + scroll/
 * resize listeners) so layout code can react to its real pixel size and
 * position instead of assuming fixed coordinates.
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
