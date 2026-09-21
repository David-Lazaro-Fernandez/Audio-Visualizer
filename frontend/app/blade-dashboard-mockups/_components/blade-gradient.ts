/**
 * DESIGN.md §2.1 Section colors, as data rather than a CSS string.
 *
 * Each section's signature radial gradient has to be readable by two very
 * different painters now: the CSS `background` that every surface falls
 * back to, and the WebGL surface shader (`blade-water-gl.ts`), which
 * needs the focal point, the radii and the stops as numbers. Keeping the
 * literal in one place and deriving the CSS from it means the two can't
 * drift — previously the same `radial-gradient(...)` string was retyped in
 * `page.tsx` and in all six full-screen surfaces (§9: reuse the shared
 * constants).
 *
 * Every section deliberately uses the *same four stop positions*, so a
 * blade switch is a straight per-stop `mix()` in the shader (§7.4).
 */

/** One stop, positioned as a fraction of the gradient's radius. */
export interface GradientStop {
  /** 0 at the focal point, 1 at the ellipse's edge. */
  at: number;
  /** `#rrggbb`. */
  color: string;
}

/**
 * A radial gradient in the form §2.1 uses: an ellipse sized as a fraction
 * of its box, offset to a focal point, with stops from the center out.
 */
export interface SectionGradient {
  /** Focal point as a fraction of the box — always 50% / 44% (§2.1). */
  focal: readonly [number, number];
  /** Ellipse radii as a fraction of the box — always 90% / 80%. */
  radius: readonly [number, number];
  stops: readonly GradientStop[];
}

/** Every section shares this geometry; only the colors differ. */
const FOCAL = [0.5, 0.44] as const;
const RADIUS = [0.9, 0.8] as const;
/** Shared stop positions, which is what makes §7.4's crossfade a `mix()`. */
export const STOP_POSITIONS = [0, 0.3, 0.62, 1] as const;

/** The number of stops the shader is compiled for; see `blade-water-gl.ts`. */
export const STOP_COUNT = STOP_POSITIONS.length;

const section = (...colors: string[]): SectionGradient => ({
  focal: FOCAL,
  radius: RADIUS,
  stops: colors.map((color, i) => ({ at: STOP_POSITIONS[i], color })),
});

/** Placeholder orange until the store blade is designed (§2.1). */
export const STORE_GRADIENT = section("#ff9b4a", "#f57a25", "#dd6216", "#b94d0f");
/** Xbox LIVE gold. */
export const LIVE_GRADIENT = section("#f8cd5e", "#f3ae3c", "#e4952b", "#cf7b1d");
/** Games green — the default blade. */
export const GAMES_GRADIENT = section("#6ecb2e", "#52b81f", "#3e9c16", "#2f7e10");
/** Media sky blue. */
export const MEDIA_GRADIENT = section("#6dbdf4", "#46a2e8", "#2f86d2", "#2369b4");
/** Placeholder steel until the system blade is designed (§2.1). */
export const SYSTEM_GRADIENT = section("#d9dde2", "#b9bfc7", "#9aa2ac", "#7d8690");

/** Trim trailing zeros so the derived CSS reads like a hand-written value. */
const pct = (fraction: number) => `${+(fraction * 100).toFixed(4)}%`;

/**
 * The gradient as a CSS `background` value. This is what paints before
 * hydration and wherever WebGL is unavailable, so it has to stay an exact
 * match for what the shader draws.
 */
export function gradientCss(gradient: SectionGradient): string {
  const { focal, radius, stops } = gradient;
  const shape = `${pct(radius[0])} ${pct(radius[1])} at ${pct(focal[0])} ${pct(focal[1])}`;
  const list = stops.map((s) => `${s.color} ${pct(s.at)}`).join(", ");
  return `radial-gradient(${shape}, ${list})`;
}

/**
 * `#rrggbb` to three 0..1 channels for a `vec3` uniform. Left in sRGB on
 * purpose: CSS gradients interpolate in sRGB, so the shader has to as well
 * or the midpoints of a blade crossfade would drift toward a different hue.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
