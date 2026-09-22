"use client";

import type { TuningSpec } from "@/app/_ui/TuningPanel";

/**
 * Live tuning for the raymarched core.
 *
 * Same one-way store as the other overlays: the panel writes, the scene
 * reads and subscribes.
 *
 * The knobs split the audio the way the *surface* can actually show it.
 * Twenty-eight bands cannot be read off a lump of rock — mapping them to
 * spherical harmonics would be correct and illegible — so the shape is
 * driven by two bands' worth of energy at two spatial scales: bass makes
 * broad slow swells, treble makes a fine crust. That reads at a glance,
 * which individual bands would not.
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

/** How often the knobs wander, in ms. */
export const RAYMARCH_DRIFT_MS = 1000;

export const RAYMARCH_DEFAULTS: RaymarchState = {
  bassAmp: 0.45,
  bassScale: 2,
  trebleAmp: 0.09,
  trebleScale: 10,
  glow: 1,
  radius: 1,
  distance: 3.6,
  spin: 0.12,
  resolution: 0.6,
};

let state: RaymarchState = { ...RAYMARCH_DEFAULTS };
const listeners = new Set<(state: RaymarchState) => void>();

/** Whether the knobs wander on their own. On by default, like the field. */
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
