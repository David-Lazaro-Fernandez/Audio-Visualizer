/**
 * The section colours of DESIGN.md §2.1, as data and not as a CSS
 * string.
 *
 * Two different painters must read the radial gradient of a section: the
 * CSS `background` that each surface falls back to, and the WebGL
 * surface shader (`blade-water-gl.ts`), which needs the focal point, the
 * radii and the stops as numbers. The values are here one time and the
 * CSS comes from them, thus the two painters cannot drift. Before this,
 * the same `radial-gradient(...)` string was in `page.tsx` and in all
 * six full-screen surfaces (§9: reuse the shared constants).
 *
 * Each section uses the same four stop positions. Thus a blade switch is
 * a `mix()` for each stop in the shader (§7.4).
 */

/** One stop, positioned as a fraction of the gradient's radius. */
export interface GradientStop {
  /** 0 at the focal point, 1 at the edge of the ellipse. */
  at: number;
  /** `#rrggbb`. */
  color: string;
}

/**
 * A radial gradient in the form of §2.1: an ellipse with a size that is
 * a fraction of its box, a focal point, and stops from the centre out.
 */
export interface SectionGradient {
  /** Focal point as a fraction of the box. It is always 50% / 44% (§2.1). */
  focal: readonly [number, number];
  /** Ellipse radii as a fraction of the box. They are always 90% / 80%. */
  radius: readonly [number, number];
  stops: readonly GradientStop[];
}

/** Each section uses this geometry. Only the colours are different. */
const FOCAL = [0.5, 0.44] as const;
const RADIUS = [0.9, 0.8] as const;
/** The shared stop positions. They make the crossfade of §7.4 a `mix()`. */
export const STOP_POSITIONS = [0, 0.3, 0.62, 1] as const;

/** The number of stops that the shader is compiled for. Refer to `blade-water-gl.ts`. */
export const STOP_COUNT = STOP_POSITIONS.length;

const section = (...colors: string[]): SectionGradient => ({
  focal: FOCAL,
  radius: RADIUS,
  stops: colors.map((color, i) => ({ at: STOP_POSITIONS[i], color })),
});

/** A placeholder orange until the store blade has a design (§2.1). */
export const STORE_GRADIENT = section("#ff9b4a", "#f57a25", "#dd6216", "#b94d0f");
/** Xbox LIVE gold. */
export const LIVE_GRADIENT = section("#f8cd5e", "#f3ae3c", "#e4952b", "#cf7b1d");
/** Games green. This is the default blade. */
export const GAMES_GRADIENT = section("#6ecb2e", "#52b81f", "#3e9c16", "#2f7e10");
/** Media sky blue. */
export const MEDIA_GRADIENT = section("#6dbdf4", "#46a2e8", "#2f86d2", "#2369b4");
/** A placeholder steel until the system blade has a design (§2.1). */
export const SYSTEM_GRADIENT = section("#d9dde2", "#b9bfc7", "#9aa2ac", "#7d8690");

/** Removes the trailing zeros, thus the CSS looks like a written value. */
const pct = (fraction: number) => `${+(fraction * 100).toFixed(4)}%`;

/**
 * The gradient as a CSS `background` value. It paints before the
 * hydration and where WebGL is not available, thus it must be an exact
 * match of the image that the shader draws.
 */
export function gradientCss(gradient: SectionGradient): string {
  const { focal, radius, stops } = gradient;
  const shape = `${pct(radius[0])} ${pct(radius[1])} at ${pct(focal[0])} ${pct(focal[1])}`;
  const list = stops.map((s) => `${s.color} ${pct(s.at)}`).join(", ");
  return `radial-gradient(${shape}, ${list})`;
}

/**
 * `#rrggbb` to three channels of 0..1 for a `vec3` uniform. The values
 * stay in sRGB. CSS gradients interpolate in sRGB, thus the shader must
 * also interpolate in sRGB. If it did not, the middle of a blade
 * crossfade would move to another hue.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
