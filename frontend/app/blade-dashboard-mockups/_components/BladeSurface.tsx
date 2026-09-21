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
 * The WebGL half of DESIGN.md §2.1 / §3.1 / §7.4: a `<canvas>` that
 * paints the section gradient and, over it, the water sheet whose drops
 * and swell replaced the concentric sheen, the CSS ripple rings and the
 * specular gloss (`blade-water-gl.ts`).
 *
 * It is strictly an *upgrade* over the CSS surface, never a replacement
 * the page depends on. The CSS gradient stays on the element underneath,
 * so the surface is already correct before hydration, on a browser
 * without WebGL2, and after a lost context — the canvas simply fails to
 * appear. Only once a first frame has actually been drawn does this
 * publish `painted`, which the layers that have a CSS twin (`BladeEdges`'
 * panel fill and gloss, `BladeBackground`'s sheen and rings) read in order
 * to stand down and let the shader show through. Flipping the flag only
 * after the first draw is what keeps the handover from flashing.
 *
 * The fallback is not a like-for-like picture of the water - CSS cannot
 * draw a banked sheet - but it is the surface the dashboard was designed
 * around, so a browser without WebGL2 gets a complete blade rather than a
 * broken one.
 *
 * Never a cursor stop and never hit-tested: it is `aria-hidden` and
 * `pointer-events-none`, so the tab shapes above it keep their own
 * clickable areas (§1.1).
 */
const BladeSurfacePaintedContext = createContext(false);

/** Whether the shader is live, so a CSS twin layer can stand down. */
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
  /** The open section's gradient (§2.1). Crossfades on change (§7.4). */
  gradient: SectionGradient;
  /**
   * The panel's edges in reference px (§1.2). The water is masked to the
   * curve between them and glides with it on a blade switch, so the
   * swell stays on the open blade and never spills onto the collapsed
   * tab gutters. Omit on a full-screen surface, which has no panel and
   * so carries the water unclipped (§5.4).
   */
  panel?: PanelEdges | null;
  onPaintedChange?: (painted: boolean) => void;
}) {
  const [painted, setPainted] = useState(false);
  /** Bumped to rebuild the context after it is lost and restored. */
  const [generation, setGeneration] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BladeWaterRenderer | null>(null);
  const frameRef = useRef(0);
  const runningRef = useRef(false);
  const reducedRef = useRef(false);

  // Read by the mount effect, which must not re-run on every parent
  // update or it would tear the GL context down mid-transition.
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
    // The ripples loop forever, so only a reduced-motion surface is ever
    // allowed to stop asking for frames.
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
      // No WebGL2, or a driver that will not compile the program. The CSS
      // surface underneath is already correct, so there is nothing to do
      // but leave it showing.
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
    // Paint before handing over, so the CSS layers never stand down onto
    // an empty canvas.
    renderer.draw(performance.now());
    setPainted(true);

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    // A ResizeObserver does not fire when only the pixel ratio changes,
    // which is what happens when the window moves between displays.
    window.addEventListener("resize", measure);

    const onMotionChange = () => {
      reducedRef.current = motion.matches;
      renderer.setAnimated(!motion.matches);
      request();
    };
    motion.addEventListener("change", onMotionChange);

    // A lost context hands the surface straight back to CSS; a restored
    // one rebuilds this effect from scratch.
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
    // `generation` is a rebuild trigger, not a value the effect reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, request]);

  // Primitives, so a fresh `panel` object each render does not restart the
  // transition (§7.4) on every parent update.
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
