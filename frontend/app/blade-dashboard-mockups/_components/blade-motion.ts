/**
 * DESIGN.md §7.4 Blade transition. Switching blades re-deals the hand: the
 * panel slides to its new edges, the tabs regroup on either side, the
 * gutters widen or narrow, the section color crossfades and the new
 * content lands from the direction of travel. Every moving part shares
 * this one duration and easing so they arrive together.
 *
 * The geometry animates as plain CSS transitions on `clip-path`, `left`,
 * `width` and padding: every edge is sampled from the same curve at the
 * same step count (`blade-curve.ts`), so the polygons have matching vertex
 * counts and the browser can interpolate them. Gradients can't be
 * interpolated, so color changes crossfade a fading copy of the previous
 * one instead (`BladeEdges`). Content entry uses the `blade-content-in`
 * keyframes in `app/globals.css`, offset by `--blade-enter-x`.
 */
export const BLADE_MOTION_MS = 350;
/**
 * The easing as control points, not just a string: the WebGL surface
 * (`blade-water-gl.ts`) eases the panel mask and the color crossfade
 * itself, and it has to land on exactly the same curve the CSS transitions
 * use or the shader's half of the blade switch would drift out of step
 * with the clip-path glide. The CSS value is derived from these numbers.
 */
export const BLADE_MOTION_BEZIER = [0.4, 0, 0.2, 1] as const;
export const BLADE_MOTION_EASE = `cubic-bezier(${BLADE_MOTION_BEZIER.join(",")})`;

/**
 * `cubic-bezier(x1,y1,x2,y2)` evaluated at `t`, the way the browser does
 * it: solve the x-polynomial for the bezier parameter by Newton-Raphson,
 * then read y off it. Four iterations is well inside a pixel for these
 * control points.
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

/** Progress along the blade tempo's own easing. */
export const bladeEase = (t: number) => cubicBezierEase(t, BLADE_MOTION_BEZIER);

/** `transition` shorthand for the given properties at the blade tempo. */
export const bladeTransition = (...properties: string[]) =>
  properties
    .map((p) => `${p} ${BLADE_MOTION_MS}ms ${BLADE_MOTION_EASE}`)
    .join(", ");

/** How far new panel content travels as it lands, in px. */
export const CONTENT_ENTER_PX = 28;
