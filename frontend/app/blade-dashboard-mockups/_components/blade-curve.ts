/**
 * DESIGN.md §1.1 blade curve geometry: every edge (collapsed tabs + the
 * active panel) is generated from the same "lazy S" curve, just shifted to
 * a different top-x — DESIGN.md's reference curve, scaled to 90% of its
 * bow/flare radius.
 *
 * Rendered as plain <div>s clipped with `clip-path: polygon(...)` instead
 * of an <svg>/<path> — the curve is sampled at many points along the same
 * cubic bezier math SVG would have used, so the shape is just as smooth,
 * but the element is a div sized to 100%/100% of its box.
 */
type Point = { x: number; y: number };

// Fractions of the tab's own height (0 = top edge, 1 = bottom edge).
const EDGE_Y = [0, 130, 250, 380, 510, 625, 720] as const;
export const CANVAS_HEIGHT = EDGE_Y[EDGE_Y.length - 1];

const CURVE_SCALE = 0.9;
// DESIGN.md's reference deltas (bow left/-, then flare right/+), relative
// to a "right-family" edge's top-x, scaled by CURVE_SCALE.
const RIGHT_FAMILY_DELTAS = [0, -13, -19, -13, -7, 30, 85].map(
  (d) => d * CURVE_SCALE,
);

function edgePoints(topX: number, mirrored: boolean): number[] {
  return RIGHT_FAMILY_DELTAS.map((d) => topX + (mirrored ? -d : d));
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    points.push({
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    });
  }
  return points;
}

const STEPS_PER_SEGMENT = 16;

/** Samples one edge's full curve (top to bottom) as a smooth point list. */
function sampleEdge(topX: number, mirrored: boolean): Point[] {
  const xs = edgePoints(topX, mirrored);
  const pt = (i: number): Point => ({ x: xs[i], y: EDGE_Y[i] });
  const first = cubicBezier(pt(0), pt(1), pt(2), pt(3), STEPS_PER_SEGMENT);
  const second = cubicBezier(pt(3), pt(4), pt(5), pt(6), STEPS_PER_SEGMENT);
  return [...first, ...second.slice(1)];
}

function toClipPath(points: Point[], width: number, xOffset: number): string {
  const vertices = points
    .map(({ x, y }) => {
      const xPct = (((x - xOffset) / width) * 100).toFixed(2);
      const yPct = ((y / CANVAS_HEIGHT) * 100).toFixed(2);
      return `${xPct}% ${yPct}%`;
    })
    .join(", ");
  return `polygon(${vertices})`;
}

/**
 * The closed band between two edges that curve in tandem (e.g. one tab, or
 * the panel), as a CSS `clip-path` for a div spanning the *whole* 1280-wide
 * canvas (left/right in canvas-relative %, matching `BladeMenuGutters`
 * etc.) — used for the panel, which isn't its own small positioned box.
 */
export function bandClipPath(
  leftTopX: number,
  rightTopX: number,
  leftMirrored: boolean,
  rightMirrored = leftMirrored,
): string {
  const left = sampleEdge(leftTopX, leftMirrored);
  const right = sampleEdge(rightTopX, rightMirrored).reverse();
  return toClipPath([...left, ...right], 1280, 0);
}

export interface TabGeometry {
  /** `clip-path` value, normalized so the shape's own box starts at x=0. */
  clipPath: string;
  /** The bounding box width, in canvas-relative % (of 1280). */
  widthPct: number;
  /** Where the bounding box starts, in canvas-relative % (of 1280). */
  leftPct: number;
}

/**
 * Same curve as `bandClipPath`, but returns the tab's own bounding box (the
 * curve bows and flares outside its "top width", so the box has to cover
 * the widest excursion) with the clip-path renormalized to that box's
 * origin — so the tab can be a small, self-contained, independently
 * positioned div instead of needing the whole 1280-wide canvas.
 */
export function tabGeometry(
  topLeftX: number,
  topRightX: number,
  mirrored: boolean,
): TabGeometry {
  const left = sampleEdge(topLeftX, mirrored);
  const right = sampleEdge(topRightX, mirrored).reverse();
  const allXs = [...left, ...right].map((p) => p.x);
  const minX = Math.min(...allXs);
  const maxX = Math.max(...allXs);
  const widthPx = maxX - minX;

  return {
    clipPath: toClipPath([...left, ...right], widthPx, minX),
    widthPct: (widthPx / 1280) * 100,
    leftPct: (minX / 1280) * 100,
  };
}

/**
 * The lazy S as a plain function of y, for the WebGL surface
 * (`blade-water-gl.ts`). The shader has to mask the water sheet to the
 * panel, and it gets no `clip-path` — but every edge in §1.1
 * is the *same* curve shifted to a different top-x, so one table of
 * x-deltas is enough: the panel's left edge is `leftX - d(y)` (mirrored)
 * and its right edge is `rightX + d(y)`. That also makes the §7.4
 * transition two scalars for the shader to ease, instead of 66 vertices.
 *
 * The curve is parametric (y is a bezier of t, not linear in it), so this
 * resamples it onto a uniform y grid the shader can index directly.
 * Deltas are in reference px, already scaled by `CURVE_SCALE`.
 */
export function edgeDeltaTable(samples: number): Float32Array {
  const curve = sampleEdge(0, false);
  const table = new Float32Array(samples);
  let segment = 0;
  for (let i = 0; i < samples; i++) {
    const y = (i / (samples - 1)) * CANVAS_HEIGHT;
    // The samples march down the curve in step with the table, so the
    // segment cursor only ever moves forward.
    while (segment < curve.length - 2 && curve[segment + 1].y < y) segment++;
    const a = curve[segment];
    const b = curve[segment + 1];
    const span = b.y - a.y;
    const t = span === 0 ? 0 : (y - a.y) / span;
    table[i] = a.x + (b.x - a.x) * t;
  }
  return table;
}
