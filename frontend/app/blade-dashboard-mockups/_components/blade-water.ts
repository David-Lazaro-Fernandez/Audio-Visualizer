/**
 * The water of the blade background: its tuned wave parameters, its view
 * and the method that makes a water palette from a section colour.
 *
 * DESIGN.md §3.1. The background is two layers in one canvas. The radial
 * gradient of §2.1 is below. A water surface is above it and adds only
 * its relief: sky on the crests, a deep tint in the troughs and nothing
 * where the water is still. Thus a blade with no drops looks exactly
 * like the gradient, and the ripples are an addition on top of it.
 */

import type { WaterParamSpec } from "@/app/_water/water-params";
import { hexToRgb, type SectionGradient } from "./blade-gradient";

/**
 * Tuned for a 10-foot background and not for a macro photograph. The
 * wavelength is very long, because k = 1 gives lambda near 6.3 world
 * units. The front is slow. The packet is narrow, thus each drop is one
 * broad swell and not a train of rings. The fade is long, thus the
 * surface is never fully still. `uHeightScale` holds the exaggeration
 * that makes the waves visible at this amplitude.
 *
 * Nothing here draws the drop. A dashboard needs the swell and not the
 * splash, thus the crater and the jet are zero, and `uQuiet` hides each
 * drop until its wave leaves the origin. Each value is adjustable at run
 * time from `BladeWaterControls`.
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
  // Hides each drop until its wave travels this distance, thus the
  // background shows a swell that arrives and not a drop that lands.
  // Refer to `uJetB` below for the other half of this.
  uQuiet: 1.5,

  // The crater and the jet are off. They are the impact and not the
  // wave: a spike 0.25 units wide across a metre of screen. At this
  // height scale the spike saturates the relief into a hard bright point
  // at each drop. `/demo` keeps them, because there they are the
  // subject. The previous values were 1.2 and 0.4.
  uJetB: 0,
  uJetS: 0.25,
  uJetTau: 0.12,
  uCraterC: 0,
  uCraterTau: 0.06,

  uGravity: 1.0,
  uCapillary: 0.4,
  // This surface has no contour view, thus the shader does not declare
  // this uniform. It is here only to keep the set equal to `/demo`.
  uContourFreq: 20,

  uDispersion: 0,
};

/**
 * The view. It is the same as `/demo`, thus the wave parameters keep the
 * meaning that they had when they were tuned there.
 *
 * `TILT_Z_DEG` banks the sheet. The code builds the plane in XZ and then
 * rotates it about the world Z axis. A larger bank turns the sheet more
 * into the line of sight of the camera, until its vanishing line enters
 * the frame and one corner is at grazing incidence. On 16:9 that occurs
 * at 45 degrees, thus the default is 20. The bank is adjustable at run
 * time from `BladeWaterControls`.
 */
export const WATER_CAMERA = { fov: 35, position: [0, 14, 22] as const };
/** The bank at the start, in degrees. The tuning overlay can change it. */
export const TILT_Z_DEG = 20;

/**
 * The sheet is much larger than the near 16 world units that the camera
 * sees, thus its edges stay out of the frame after the bank. 512
 * segments across 240 units is 0.47 units for each segment, which is 13
 * segments for each wavelength at k = 1. This is more than the 8
 * segments that the silhouette needs, because the per-pixel normals do
 * the other work.
 */
export const WATER_PLANE_SIZE = 240;
export const WATER_PLANE_SEGMENTS = 512;

/** Seconds between two drops, plus a maximum of this much jitter. */
export const DROP_INTERVAL = 1.6;
export const DROP_JITTER = 1.1;
/**
 * Where a drop lands, in the coordinates of the plane. The spread is
 * wider in x than in z, because the bank foreshortens x. Thus a wider
 * spread in x covers the same area of the screen.
 */
export const DROP_SPREAD_X = 14;
export const DROP_SPREAD_Z = 10;

/**
 * How much the relief changes the gradient. `RELIEF_GAIN` converts the
 * wave height to an opacity, and `RELIEF_OPACITY` is the maximum for the
 * full layer. Together they keep the effect a small swell and prevent a
 * pond that covers the dashboard.
 */
export const RELIEF_GAIN = 4;
export const RELIEF_OPACITY = 0.85;

/**
 * The knobs of this surface that the shared wave table does not have:
 * the orientation of the sheet, the strength of its relief on the
 * gradient, and the drop rate. They have the same shape as
 * `WATER_PARAMS`, thus one slider component renders both sets.
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

/** The light direction, the same as `/demo`. The shader normalizes it. */
export const WATER_LIGHT_DIR = [0.3, 1.0, 0.2] as const;

/** The sky and the depth of the water, in the section colour (§2.2). */
export interface WaterPalette {
  deep: [number, number, number];
  horizon: [number, number, number];
  zenith: [number, number, number];
}

/** How much the code darkens the outer gradient stop to make deep water. */
const DEEP_FACTOR = 0.55;
/** How much the code lifts the inner stop toward white to make sky. */
const ZENITH_LIFT = 0.6;

/**
 * Derives a water palette from the gradient of a section (§2.1). Thus
 * the water is green on Games, gold on Xbox LIVE and blue on Media, and
 * no second table of colours is necessary. The gradient is already
 * bright at the focal point and dark at the rim, which is the range that
 * the water needs: its inner stop is the sky and its outer stop is the
 * depth.
 *
 * The values stay in sRGB. This surface composites over the CSS gradient
 * and must match it pixel for pixel, thus it does not use a linear
 * working space.
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
