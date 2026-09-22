"use client";

import type { TuningSpec } from "@/app/_ui/TuningPanel";

/**
 * Live tuning for the raymarched core.
 *
 * It uses the same one-way store as the other overlays: the panel
 * writes, the scene reads and subscribes.
 *
 * The tunnel knobs are the exception to the two energies at two scales
 * below. The tunnel is not the surface of the core. It is the space
 * around the core, thus it takes the bass as light and not as
 * displacement.
 *
 * The knobs divide the audio in the way that the surface can show it.
 * You cannot read 28 bands off a lump of rock. Spherical harmonics would
 * be correct and impossible to read. Thus two energies at two spatial
 * scales drive the shape: the bass makes broad slow swells and the
 * treble makes a fine crust. A viewer can read that immediately, but
 * cannot read separate bands.
 */
export const RAYMARCH_SPECS = {
  bassAmp: {
    label: "Bass swell",
    min: 0,
    max: 1.5,
    step: 0.01,
    primary: true,
    driftScale: 1,
    hint: "How far the low end pushes the surface out. The broad, slow deformation",
  },
  bassScale: {
    label: "Swell size",
    min: 0.5,
    max: 8,
    step: 0.1,
    primary: true,
    driftScale: 0.8,
    hint: "Spatial frequency of the bass lumps. Low is a couple of big bulges, high is many",
  },
  trebleAmp: {
    label: "Treble crust",
    min: 0,
    max: 0.6,
    step: 0.005,
    primary: true,
    driftScale: 1,
    hint: "How much the high end roughens the surface. Keep it small; it is detail, not shape",
  },
  trebleScale: {
    label: "Crust detail",
    min: 2,
    max: 30,
    step: 0.5,
    primary: true,
    driftScale: 0.8,
    hint: "Spatial frequency of the crust. High is sandpaper, low is ridges",
  },
  glow: {
    label: "Silhouette glow",
    min: 0,
    max: 3,
    step: 0.05,
    primary: true,
    driftScale: 0.6,
    hint: "Bloom around the edge, from how close each missed ray passed. Free: the marcher already knows",
  },
  radius: {
    label: "Core radius",
    min: 0.4,
    max: 3,
    step: 0.05,
    driftScale: 0.4,
    hint: "The undisplaced sphere the noise is added to",
  },
  distance: {
    label: "Camera distance",
    min: 2,
    max: 10,
    step: 0.1,
    driftScale: 0.3,
    hint: "How far the orbiting camera sits from the core",
  },
  spin: {
    label: "Orbit speed",
    min: 0,
    max: 0.6,
    step: 0.01,
    driftScale: 0.5,
    hint: "Radians a second the camera circles. Zero holds still",
  },
  tunnelGlow: {
    label: "Tunnel",
    min: 0,
    max: 2,
    step: 0.05,
    primary: true,
    driftScale: 0.5,
    hint: "Brightness of the tunnel the core hangs in. Zero leaves it on plain black",
  },
  tunnelFlash: {
    label: "Tunnel flash",
    min: 0,
    max: 2,
    step: 0.05,
    primary: true,
    driftScale: 0.4,
    hint: "How hard a bass onset throws a ring of light down the tunnel. It is gone in under a fifth of a second",
  },
  tunnelSpeed: {
    label: "Flight speed",
    min: 0,
    max: 2,
    step: 0.05,
    primary: true,
    driftScale: 0.6,
    hint: "How fast the tunnel flies past. Zero holds it still",
  },
  tunnelRings: {
    label: "Ring spacing",
    min: 1,
    max: 12,
    step: 0.5,
    driftScale: 0.4,
    hint: "Rings per unit of depth. High is a dense ladder, low is a few wide hoops",
  },
  tunnelCurve: {
    label: "Bend",
    min: -6,
    max: 6,
    step: 0.05,
    primary: true,
    driftScale: 0.6,
    hint: "How far the corridor wanders off a straight line, and which way it leans first. Zero is a straight pipe, negative is the same curve mirrored; past about 4 either way the vanishing point stops resolving and the extra bend is noise",
  },
  tunnelSegments: {
    label: "Segments",
    min: 3,
    max: 16,
    step: 1,
    driftScale: 0.4,
    hint: "Lines running away from you around the wall",
  },
  resolution: {
    label: "Resolution",
    min: 0.25,
    max: 1,
    step: 0.05,
    driftScale: 0,
    hint: "Fraction of device pixels marched. Raymarching costs per pixel, so this is the performance dial",
  },
} as const satisfies Record<string, TuningSpec>;

export type RaymarchKey = keyof typeof RAYMARCH_SPECS;
export type RaymarchState = Record<RaymarchKey, number>;

export const RAYMARCH_KEYS = Object.keys(RAYMARCH_SPECS) as RaymarchKey[];

/** The interval between two steps of the walk, in ms. */
export const RAYMARCH_DRIFT_MS = 1000;

export const RAYMARCH_DEFAULTS: RaymarchState = {
  bassAmp: 1.5,
  bassScale: 8,
  trebleAmp: 0.585,
  trebleScale: 21,
  glow: 1.15,
  radius: 1.03,
  distance: 4.4,
  spin: 0.51,
  tunnelGlow: 1.55,
  tunnelFlash: 0.92,
  tunnelSpeed: 1.4,
  tunnelCurve: 4.05,
  tunnelRings: 2.5,
  tunnelSegments: 15,
  resolution: 0.6,
};

let state: RaymarchState = { ...RAYMARCH_DEFAULTS };
const listeners = new Set<(state: RaymarchState) => void>();

/**
 * Whether the knobs wander without input. It is on by default, as with
 * the field. A scene that does not want the walk sets the `drift` prop
 * on `RaymarchCore` when it mounts the core. Thus one scene does not
 * change this flag for the other scenes.
 */
let drifting = true;
const driftListeners = new Set<(on: boolean) => void>();

export function raymarchState(): Readonly<RaymarchState> {
  return state;
}

export function setRaymarchControl(key: RaymarchKey, value: number) {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  for (const listener of listeners) listener(state);
}

export function resetRaymarchControls() {
  state = { ...RAYMARCH_DEFAULTS };
  for (const listener of listeners) listener(state);
}

export function subscribeRaymarch(
  listener: (state: RaymarchState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function raymarchDrifting() {
  return drifting;
}

export function setRaymarchDrifting(on: boolean) {
  if (drifting === on) return;
  drifting = on;
  for (const listener of driftListeners) listener(on);
}

export function subscribeRaymarchDrifting(
  listener: (on: boolean) => void,
): () => void {
  driftListeners.add(listener);
  return () => driftListeners.delete(listener);
}
