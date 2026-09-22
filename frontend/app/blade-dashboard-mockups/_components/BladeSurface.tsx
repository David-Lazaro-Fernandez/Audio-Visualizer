"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BladeWaterRenderer,
  type PanelEdges,
  type SurfaceState,
} from "./blade-water-gl";
import type { SectionGradient } from "./blade-gradient";

/**
 * The WebGL half of DESIGN.md §2.1, §3.1 and §7.4: a `<canvas>` that
 * paints the section gradient with the water sheet above it. The drops
 * and the swell of that sheet replaced the concentric sheen, the CSS
 * ripple rings and the specular gloss (`blade-water-gl.ts`).
 *
 * The canvas is an upgrade of the CSS surface and never a replacement
 * that the page needs. The CSS gradient stays on the element below,
 * thus the surface is correct before the hydration, on a browser with
 * no WebGL2, and after a lost context: only the canvas is absent. This
 * component publishes `painted` only after it draws the first frame.
 * The layers that have a CSS twin, which are the panel fill and the
 * gloss of `BladeEdges` and the sheen and the rings of
 * `BladeBackground`, read that flag and stop drawing, thus the shader
 * shows. The flag changes only after the first draw, thus the handover
 * does not flash.
 *
 * The fallback is not an equal image of the water, because CSS cannot
 * draw a banked sheet. But it is the surface that the dashboard was
 * designed around, thus a browser with no WebGL2 gets a complete blade
 * and not a broken one.
 *
 * The canvas is never a cursor stop and is never hit-tested. It is
 * `aria-hidden` and `pointer-events-none`, thus the tab shapes above it
 * keep their own clickable areas (§1.1).
 */
const BladeSurfacePaintedContext = createContext(false);

/** Whether the shader is live. A CSS twin layer reads this and stops drawing. */
export function useBladeSurfacePainted(): boolean {
  return useContext(BladeSurfacePaintedContext);
}

export function BladeSurfacePaintedProvider({
  painted,
  children,
}: {
  painted: boolean;
  children: React.ReactNode;
}) {
  return (
    <BladeSurfacePaintedContext.Provider value={painted}>
      {children}
    </BladeSurfacePaintedContext.Provider>
  );
}

export function BladeSurface({
  gradient,
  panel = null,
  onPaintedChange,
}: {
  /** The gradient of the open section (§2.1). A change crossfades (§7.4). */
  gradient: SectionGradient;
  /**
   * The edges of the panel in reference px (§1.2). The mask holds the
   * water inside the curve between them and glides with it during a
   * blade switch. Thus the swell stays on the open blade and does not go
   * onto the collapsed tab gutters. Omit this prop on a full-screen
   * surface: it has no panel, thus its water is not clipped (§5.4).
   */
  panel?: PanelEdges | null;
  onPaintedChange?: (painted: boolean) => void;
}) {
  const [painted, setPainted] = useState(false);
  /** Incremented to rebuild the context after a loss and a restore. */
  const [generation, setGeneration] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BladeWaterRenderer | null>(null);
  const frameRef = useRef(0);
  const runningRef = useRef(false);
  const reducedRef = useRef(false);

  // The mount effect reads this. That effect must not run again at each
  // update of the parent, or it would destroy the GL context during a
  // transition.
  const stateRef = useRef<SurfaceState>({ gradient, panel });
  stateRef.current = { gradient, panel };

  const paintedCallbackRef = useRef(onPaintedChange);
  paintedCallbackRef.current = onPaintedChange;
  useEffect(() => {
    paintedCallbackRef.current?.(painted);
  }, [painted]);

  const tick = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      runningRef.current = false;
      return;
    }
    const now = performance.now();
    renderer.draw(now);
    // The ripples continue without an end, thus only a reduced-motion
    // surface can stop the request for frames.
    if (reducedRef.current && renderer.settled(now)) {
      runningRef.current = false;
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const request = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = motion.matches;

    let renderer: BladeWaterRenderer;
    try {
      renderer = new BladeWaterRenderer(canvas, stateRef.current);
    } catch (error) {
      // There is no WebGL2, or the driver cannot compile the program. The
      // CSS surface below is correct, thus keep it on the screen.
      if (process.env.NODE_ENV !== "production") {
        console.warn("Blade surface falling back to CSS:", error);
      }
      return;
    }
    rendererRef.current = renderer;
    renderer.setAnimated(!reducedRef.current);

    const measure = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.resize(width, height, window.devicePixelRatio || 1);
      request();
    };

    measure();
    // Paint before the handover, thus the CSS layers never stop drawing
    // onto an empty canvas.
    renderer.draw(performance.now());
    setPainted(true);

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    // A ResizeObserver does not fire when only the pixel ratio changes.
    // That occurs when the window moves to another display.
    window.addEventListener("resize", measure);

    const onMotionChange = () => {
      reducedRef.current = motion.matches;
      renderer.setAnimated(!motion.matches);
      request();
    };
    motion.addEventListener("change", onMotionChange);

    // A lost context returns the surface to CSS. A restored context
    // builds this effect again.
    const onLost = (event: Event) => {
      event.preventDefault();
      setPainted(false);
    };
    const onRestored = () => setGeneration((n) => n + 1);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    request();

    return () => {
      cancelAnimationFrame(frameRef.current);
      runningRef.current = false;
      observer.disconnect();
      window.removeEventListener("resize", measure);
      motion.removeEventListener("change", onMotionChange);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      rendererRef.current = null;
      renderer.dispose();
      setPainted(false);
    };
    // `generation` is a trigger for a rebuild, not a value that the
    // effect reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, request]);

  // Primitives, thus a new `panel` object at each render does not start
  // the transition (§7.4) again at each update of the parent.
  const leftX = panel?.leftX ?? null;
  const rightX = panel?.rightX ?? null;
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setState(
      {
        gradient,
        panel: leftX === null || rightX === null ? null : { leftX, rightX },
      },
      performance.now(),
    );
    request();
  }, [gradient, leftX, rightX, request]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: painted ? 1 : 0 }}
    />
  );
}
