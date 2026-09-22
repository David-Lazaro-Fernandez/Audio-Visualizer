/**
 * The blade transition of DESIGN.md §7.4. A blade switch deals the hand
 * again: the panel slides to its new edges, the tabs regroup on the two
 * sides, the gutters become wider or narrower, the section color
 * crossfades, and the new content arrives from the direction of travel.
 * Each moving part uses this one duration and this one easing, thus they
 * arrive together.
 *
 * The geometry animates as plain CSS transitions on `clip-path`, `left`,
 * `width` and the padding. The code samples each edge from the same
 * curve at the same step count (`blade-curve.ts`), thus the polygons
 * have equal vertex counts and the browser can interpolate them. CSS
 * cannot interpolate two gradients, thus a colour change fades out a
 * copy of the previous colour (`BladeEdges`). The content entry uses the
 * `blade-content-in` keyframes in `app/globals.css`, with the offset
 * `--blade-enter-x`.
 */
export const BLADE_MOTION_MS = 350;
/**
 * The easing as control points and not only as a string. The WebGL
 * surface (`blade-water-gl.ts`) eases the panel mask and the colour
 * crossfade itself, and it must use exactly the curve of the CSS
 * transitions. If it did not, the shader and the clip-path glide would
 * move apart during a blade switch. The CSS value comes from these
 * numbers.
 */
export const BLADE_MOTION_BEZIER = [0.4, 0, 0.2, 1] as const;
export const BLADE_MOTION_EASE = `cubic-bezier(${BLADE_MOTION_BEZIER.join(",")})`;

/**
 * `cubic-bezier(x1,y1,x2,y2)` at `t`, computed as the browser computes
 * it. The function solves the x-polynomial for the bezier parameter with
 * the Newton-Raphson method, then reads y. Four iterations give an error
 * of less than one pixel for these control points.
 */
export function cubicBezierEase(
  t: number,
  [x1, y1, x2, y2]: readonly [number, number, number, number],
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const axis = (a: number, b: number, u: number) => {
    const mu = 1 - u;
    return 3 * mu * mu * u * a + 3 * mu * u * u * b + u * u * u;
  };
  const slope = (a: number, b: number, u: number) => {
    const mu = 1 - u;
    return 3 * mu * mu * a + 6 * mu * u * (b - a) + 3 * u * u * (1 - b);
  };
  let u = t;
  for (let i = 0; i < 4; i++) {
    const d = slope(x1, x2, u);
    if (Math.abs(d) < 1e-6) break;
    u -= (axis(x1, x2, u) - t) / d;
    u = Math.min(1, Math.max(0, u));
  }
  return axis(y1, y2, u);
}

/** Progress along the easing of the blade tempo. */
export const bladeEase = (t: number) => cubicBezierEase(t, BLADE_MOTION_BEZIER);

/** A `transition` shorthand for the given properties, at the blade tempo. */
export const bladeTransition = (...properties: string[]) =>
  properties
    .map((p) => `${p} ${BLADE_MOTION_MS}ms ${BLADE_MOTION_EASE}`)
    .join(", ");

/** The distance that new panel content travels as it arrives, in px. */
export const CONTENT_ENTER_PX = 28;
