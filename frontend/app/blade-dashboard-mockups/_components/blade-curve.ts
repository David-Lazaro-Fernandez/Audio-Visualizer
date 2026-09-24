/**
 * The blade curve geometry of DESIGN.md §1.1. One "lazy S" curve makes
 * each edge, which is each collapsed tab and the active panel. Only the
 * top-x changes. The curve is the reference curve of DESIGN.md, scaled
 * to 90% of its bow and flare radius.
 *
 * The code draws plain <div>s clipped with `clip-path: polygon(...)` and
 * not an <svg> or a <path>. It samples the curve at many points with the
 * same cubic bezier math that SVG would use, thus the shape is equally
 * smooth, and the element is a div at 100% of its box.
 */
type Point = { x: number; y: number };

// Positions down the curve, in reference px (0 is the top edge).
const EDGE_Y = [0, 130, 250, 380, 510, 625, 720] as const;
export const CANVAS_HEIGHT = EDGE_Y[EDGE_Y.length - 1];

const CURVE_SCALE = 0.9;
// The reference deltas of DESIGN.md. A negative value bows left and a
// positive value flares right. They are relative to the top-x of a
// right-family edge, and CURVE_SCALE scales them.
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

/** Samples the full curve of one edge, top to bottom, as a point list. */
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
 * The closed band between two edges that curve together, such as one tab
 * or the panel. The result is a CSS `clip-path` for a div that spans the
 * full 1280-wide canvas, with the left and the right in canvas-relative
 * %, as `BladeMenuGutters` uses. The panel uses this function, because
 * the panel is not a small positioned box.
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

export interface EdgeBandGeometry {
  /** The `clip-path` value, normalized to a box that starts at x=0. */
  clipPath: string;
  /** Width of the bounding box, in the same px scale as the two top-x values. */
  widthPx: number;
  /** Left edge of the bounding box, in that same scale (it can be negative: the curve bows outside the band's own top width). */
  leftPx: number;
}

/**
 * The band between two edges of the same curve family, close together,
 * such as one collapsed tab: two curves, not one, which is what actually
 * gives the shape its ribbon look, evenly wide top to bottom, rather
 * than one wavy boundary against a straight edge. The curve bows and
 * flares outside the top width of the band, thus the box that the
 * clip-path applies to must cover the largest excursion, and the result
 * is normalized to that box's own origin.
 */
function edgeBand(topLeftX: number, topRightX: number, mirrored: boolean): EdgeBandGeometry {
  const left = sampleEdge(topLeftX, mirrored);
  const right = sampleEdge(topRightX, mirrored).reverse();
  const allXs = [...left, ...right].map((p) => p.x);
  const minX = Math.min(...allXs);
  const maxX = Math.max(...allXs);
  const widthPx = maxX - minX;

  return {
    clipPath: toClipPath([...left, ...right], widthPx, minX),
    widthPx,
    leftPx: minX,
  };
}

/**
 * `edgeBand`, at the band's own scale, in px and not as a fraction of the
 * 1280-wide canvas. `tabGeometry` fits a collapsed tab of the blade
 * canvas, which must report its position as a fraction of that canvas;
 * this fits a shape elsewhere, at a scale of its own, such as the
 * curved ribbon of the Connect to Xbox LIVE drawer (DESIGN.md §6.22).
 */
export function edgeBandGeometry(
  topLeftX: number,
  topRightX: number,
  mirrored: boolean,
): EdgeBandGeometry {
  return edgeBand(topLeftX, topRightX, mirrored);
}

/**
 * A box whose left, top and bottom edges are the straight edges of its
 * own rectangle and whose right edge is the §1.1 curve at `topX` — a
 * shape that borrows the curve on one side only. The Connect to Xbox
 * LIVE drawer (DESIGN.md §6.22) clips its own content panel with this at
 * the *same* `topX` its ribbon's inner edge uses (`edgeBandGeometry`),
 * so the panel's right boundary and the ribbon's left boundary are the
 * same curve, not two independently-drawn approximations of it — the
 * only way two shapes drawn from the same family are guaranteed to meet
 * with no gap at every y and not just at the sampled stops. `width` is
 * the width of the box the clip-path applies to, in the same px scale
 * as `topX`, and must reach at least as far as the curve's own flare
 * (`topX` plus the family's largest positive delta) or the panel's own
 * background is cut short of where the ribbon still covers it.
 */
export function edgeOnlyClipPath(topX: number, mirrored: boolean, width: number): string {
  const curve = sampleEdge(topX, mirrored);
  const points = [{ x: 0, y: 0 }, ...curve, { x: 0, y: CANVAS_HEIGHT }];
  return toClipPath(points, width, 0);
}

/**
 * The mirror image of `edgeOnlyClipPath`: straight top, bottom and
 * *right* edges, with the §1.1 curve at `topX` as the left edge instead.
 * `topX` is also the box's own left origin — the box spans from `topX`
 * to `topX + width` — which is what a box anchored to the *right* of the
 * curve needs, such as the right tab gutter (`BladeMenuGutters`,
 * DESIGN.md §2.3): its own boundary must retreat wherever the panel's
 * curve flares into its territory, exactly as the panel's right edge
 * does, because they are the same curve at the same `topX`.
 */
export function edgeOnlyClipPathFromRight(topX: number, mirrored: boolean, width: number): string {
  const curve = sampleEdge(topX, mirrored);
  const boxRight = topX + width;
  const points = [{ x: boxRight, y: 0 }, ...curve, { x: boxRight, y: CANVAS_HEIGHT }];
  return toClipPath(points, width, topX);
}

/**
 * The §1.1 curve at `topX`, as an SVG path `d` (a polyline through the
 * same samples `sampleEdge` produces), in absolute coordinates and not
 * normalized to a box. `clip-path` is the right tool for a filled shape,
 * but a `filter: drop-shadow(...)` on the same element gets clipped away
 * with it — clip-path clips the filter's own output, not just the fill
 * — so a stroke that needs to cast a shadow past its own line, such as
 * the Connect to Xbox LIVE drawer's seam stroke (DESIGN.md §6.22), has
 * to be an actual vector path instead, with nothing clipping it.
 */
export function edgeSvgPathD(topX: number, mirrored: boolean): string {
  return sampleEdge(topX, mirrored)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

export interface TabGeometry {
  /** The `clip-path` value, normalized to a box that starts at x=0. */
  clipPath: string;
  /** Width of the bounding box, in canvas-relative % of 1280. */
  widthPct: number;
  /** Start of the bounding box, in canvas-relative % of 1280. */
  leftPct: number;
}

/**
 * The same curve as `bandClipPath`, but this function returns the
 * bounding box of the tab, with the clip-path normalized to the origin
 * of that box. The curve bows and flares outside the top width of the
 * tab, thus the box must cover the largest excursion. Thus a tab is a
 * small independent div and does not need the full 1280-wide canvas.
 */
export function tabGeometry(
  topLeftX: number,
  topRightX: number,
  mirrored: boolean,
): TabGeometry {
  const { clipPath, widthPx, leftPx } = edgeBand(topLeftX, topRightX, mirrored);
  return {
    clipPath,
    widthPct: (widthPx / 1280) * 100,
    leftPct: (leftPx / 1280) * 100,
  };
}

/**
 * The lazy S as a function of y, for the WebGL surface
 * (`blade-water-gl.ts`). The shader must mask the water sheet to the
 * panel, and it has no `clip-path`. Each edge in §1.1 is the same curve
 * at a different top-x, thus one table of x-deltas is sufficient: the
 * left edge of the panel is `leftX - d(y)`, which is mirrored, and its
 * right edge is `rightX + d(y)`. Thus the shader eases the §7.4
 * transition with two scalars and not with 66 vertices.
 *
 * The curve is parametric, because y is a bezier of t and not linear in
 * t. Thus this function resamples the curve onto a uniform y grid that
 * the shader can index directly. The deltas are in reference px, and
 * `CURVE_SCALE` already scaled them.
 */
export function edgeDeltaTable(samples: number): Float32Array {
  const curve = sampleEdge(0, false);
  const table = new Float32Array(samples);
  let segment = 0;
  for (let i = 0; i < samples; i++) {
    const y = (i / (samples - 1)) * CANVAS_HEIGHT;
    // The samples move down the curve with the table, thus the segment
    // cursor only moves forward.
    while (segment < curve.length - 2 && curve[segment + 1].y < y) segment++;
    const a = curve[segment];
    const b = curve[segment + 1];
    const span = b.y - a.y;
    const t = span === 0 ? 0 : (y - a.y) / span;
    table[i] = a.x + (b.x - a.x) * t;
  }
  return table;
}
