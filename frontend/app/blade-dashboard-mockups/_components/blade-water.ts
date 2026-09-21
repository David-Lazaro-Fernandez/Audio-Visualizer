/**
 * The blade background's water: its tuned wave parameters, its view, and
 * how a section color becomes a water palette.
 *
 * DESIGN.md §3.1. The background is two layers in one canvas: the §2.1
 * radial gradient underneath, and a water surface over it contributing
 * only its *relief* - sky on the crests, deep tint in the troughs,
 * nothing at all where the water is still. So an undisturbed blade looks
 * exactly like the gradient it always was, and the ripples are something
 * that happens on top of it rather than a replacement for it.
 */

import type { WaterParamSpec } from "@/app/_water/water-params";
import { hexToRgb, type SectionGradient } from "./blade-gradient";

/**
 * Tuned for a 10-foot background rather than a macro photograph: a very
 * long wavelength (k = 1 gives lambda ~= 6.3 world units), a slow front,
 * a narrow packet so each drop reads as one broad swell instead of a
 * train of rings, and a long fade so the surface is never quite still.
 * `uHeightScale` carries the exaggeration that makes any of it visible at
 * this amplitude.
 *
 * Nothing here draws the drop itself. A dashboard wants the swell, not
 * the splash, so the crater and jet are zeroed and `uQuiet` suppresses
 * each drop until its wave has cleared its origin. Every value is
 * live-adjustable from `BladeWaterControls`.
 */
export const BLADE_WATER_PARAMS: Record<string, number> = {
  uK: 1.0,
  uSpeed: 1.6,
  uSigma0: 0.3,
  uTau: 6.35,
  uHeightScale: 1.4,

  uAmp: 0.15,
  uSigmaGrowth: 0.6,
  uViscosity: 0.005,
  uR0: 1.0,
  // Hides each drop until its wave has travelled this far, so the
  // background shows a swell arriving rather than a drop landing. See
  // `uJetB` below for the other half of that.
  uQuiet: 1.5,

  // The crater and the jet are off. They are the *impact* rather than the
  // wave: a 0.25-unit-wide spike over a metre of screen, which at this
  // height scale saturates the relief into a hard bright pin-prick at
  // every drop. `/demo` keeps them, because there they are the subject.
  // The console's values were 1.2 and 0.4 if they are ever wanted back.
  uJetB: 0,
  uJetS: 0.25,
  uJetTau: 0.12,
  uCraterC: 0,
  uCraterTau: 0.06,

  uGravity: 1.0,
  uCapillary: 0.4,
  // No contour view on this surface, so the shader never declares it;
  // carried here only to keep the set complete against `/demo`.
  uContourFreq: 20,

  uDispersion: 0,
};

/**
 * The view. Matched to `/demo` so the wave parameters mean the same thing
 * they did when they were tuned there.
 *
 * `TILT_Z_DEG` banks the sheet: the plane is built lying in XZ and then
 * rotated about the world Z axis. The further it banks the more the sheet
 * turns into the camera's line of sight, until its vanishing line enters
 * frame and one corner goes to grazing incidence; 45 degrees sits right
 * at that edge on 16:9, which is why the default backed off to 20. The
 * bank is live-adjustable from `BladeWaterControls`.
 */
export const WATER_CAMERA = { fov: 35, position: [0, 14, 22] as const };
/** Starting bank, in degrees. Live-adjustable from the tuning overlay. */
export const TILT_Z_DEG = 20;

/**
 * The sheet is far larger than the ~16 world units the camera actually
 * sees, so its edges never enter frame once it is banked. 512 segments
 * over 240 units is 0.47 per segment, which is still 13 per wavelength at
 * k = 1 - comfortably past the 8 needed to carry the silhouette, since
 * per-pixel normals do the rest.
 */
export const WATER_PLANE_SIZE = 240;
export const WATER_PLANE_SEGMENTS = 512;

/** Seconds between drops, plus up to this much jitter. */
export const DROP_INTERVAL = 1.6;
export const DROP_JITTER = 1.1;
/**
 * Where drops land, in the plane's own coordinates. Wider across x than z
 * because the 45 degree bank foreshortens x, so a wider spread there
 * covers the same amount of screen.
 */
export const DROP_SPREAD_X = 14;
export const DROP_SPREAD_Z = 10;

/**
 * How hard the relief pushes into the gradient. `RELIEF_GAIN` maps wave
 * height to opacity, `RELIEF_OPACITY` caps the whole layer. Together they
 * are the only thing standing between "a hint of a swell" and "a pond
 * painted over the dashboard".
 */
export const RELIEF_GAIN = 4;
export const RELIEF_OPACITY = 0.85;

/**
 * The knobs this surface has that the shared wave table does not: how the
 * sheet is oriented, how hard its relief pushes into the gradient, and
 * how often it rains. Same shape as `WATER_PARAMS` so one slider
 * component renders both sets.
 */
export const BLADE_WATER_CONTROLS = {
  tiltZDeg: {
    label: "Rotation Z",
    min: -180,
    max: 180,
    step: 1,
    primary: true,
    hint: "Bank of the water sheet about the world Z axis, in degrees",
  },
  uRelief: {
    label: "Relief gain",
    min: 0,
    max: 20,
    step: 0.1,
    primary: true,
    hint: "How much wave height turns into opacity over the gradient",
  },
  uOpacity: {
    label: "Layer opacity",
    min: 0,
    max: 1,
    step: 0.01,
    primary: true,
    hint: "Cap on the whole water layer",
  },
  dropInterval: {
    label: "Drop interval",
    min: 0.2,
    max: 10,
    step: 0.1,
    hint: "Seconds between drops, before jitter",
  },
} as const satisfies Record<string, WaterParamSpec>;

export type BladeWaterControlKey = keyof typeof BLADE_WATER_CONTROLS;

/** Light direction, shared with `/demo`. Normalized in the shader. */
export const WATER_LIGHT_DIR = [0.3, 1.0, 0.2] as const;

/** Sky and depth for the water, in the section's own color (§2.2). */
export interface WaterPalette {
  deep: [number, number, number];
  horizon: [number, number, number];
  zenith: [number, number, number];
}

/** How dark the outermost gradient stop goes to become deep water. */
const DEEP_FACTOR = 0.55;
/** How far the innermost stop is lifted toward white to become sky. */
const ZENITH_LIFT = 0.6;

/**
 * Derives a water palette from a section's gradient (§2.1), so the water
 * is green on Games, gold on Xbox LIVE and blue on Media without anyone
 * maintaining a second table of colors. The gradient already runs bright
 * at the focal point to dark at the rim, which is exactly the range the
 * water needs: its innermost stop is the sky, its outermost the depths.
 *
 * Values stay in sRGB. This surface composites over the CSS gradient it
 * has to match pixel for pixel, so it deliberately does not go through a
 * linear working space.
 */
export function waterPalette(gradient: SectionGradient): WaterPalette {
  const stops = gradient.stops;
  const inner = hexToRgb(stops[0].color);
  const outer = hexToRgb(stops[stops.length - 1].color);
  return {
    deep: outer.map((c) => c * DEEP_FACTOR) as [number, number, number],
    horizon: inner,
    zenith: inner.map((c) => c + (1 - c) * ZENITH_LIFT) as [
      number,
      number,
      number,
    ],
  };
}
