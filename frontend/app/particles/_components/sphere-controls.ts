"use client";

import type { TuningSpec } from "@/app/_ui/TuningPanel";

/**
 * Live tuning for the particle sphere.
 *
 * This is a module-level store and not React state, for the same reason
 * as the overlays of the dashboard: a three.js scene in a `useEffect`
 * reads these values, and a change to a number must not tear down the
 * scene. The flow is one-way: the panel writes, the scene reads and
 * subscribes.
 *
 * The knobs are quantities that a user can imagine, not the quantities
 * that the shader needs. Reach is the distance that the loudest
 * particles travel, in world units, and the emitter divides it by the
 * settle time to get a speed. If the panel showed the speed, each change
 * to the drag would rescale the full cloud.
 */

export const SPHERE_SPECS = {
  reach: {
    label: "Max reach",
    min: 3,
    max: 60,
    step: 0.5,
    primary: true,
    hint: "How far the loudest particles travel, in world units. Radius reads as loudness, so this is the height of the effect",
  },
  spread: {
    label: "Ring spread",
    min: 0,
    max: 1,
    step: 0.01,
    primary: true,
    hint: "How much a band's particles scatter off its own latitude. Zero makes hard rings, one is a fog",
  },
  life: {
    label: "Lifetime (s)",
    min: 0.3,
    max: 8,
    step: 0.1,
    primary: true,
    hint: "How long a particle lives. Longer keeps more shells on screen at once",
  },
  core: {
    label: "Core radius",
    min: 0,
    max: 12,
    step: 0.1,
    primary: true,
    hint: "Radius particles are born on, so a burst is a shell rather than a point",
  },
  floor: {
    label: "Emission floor",
    min: 0.01,
    max: 0.5,
    step: 0.01,
    primary: true,
    hint: "Bands quieter than this do not emit. Raise it to thin the cloud out",
  },
  drag: {
    label: "Settle time",
    min: 0.2,
    max: 4,
    step: 0.05,
    hint: "Seconds a particle takes to slow to its reach. Short snaps out, long drifts",
  },
  quietReach: {
    label: "Quiet reach",
    min: 0,
    max: 1,
    step: 0.01,
    hint: "Fraction of the reach a barely-audible band gets, so quiet bands still leave the core",
  },
  swirl: {
    label: "Swirl",
    min: -1.5,
    max: 1.5,
    step: 0.02,
    hint: "Radians per second the cloud twists about the polar axis, so the shells shear past each other",
  },
  size: {
    label: "Particle size",
    min: 0.5,
    max: 8,
    step: 0.1,
    hint: "Point size before level and age scale it",
  },
} as const satisfies Record<string, TuningSpec>;

export type SphereKey = keyof typeof SPHERE_SPECS;
export type SphereState = Record<SphereKey, number>;

export const SPHERE_KEYS = Object.keys(SPHERE_SPECS) as SphereKey[];

export const SPHERE_DEFAULTS: SphereState = {
  reach: 11,
  spread: 0.06,
  life: 2.6,
  core: 2.4,
  floor: 0.09,
  drag: 1.1,
  quietReach: 0.12,
  swirl: 0.22,
  size: 2.4,
};

let state: SphereState = { ...SPHERE_DEFAULTS };
const listeners = new Set<(state: SphereState) => void>();

/** The current values, for a scene that starts now. */
export function sphereState(): Readonly<SphereState> {
  return state;
}

export function setSphereControl(key: SphereKey, value: number) {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  for (const listener of listeners) listener(state);
}

export function resetSphereControls() {
  state = { ...SPHERE_DEFAULTS };
  for (const listener of listeners) listener(state);
}

/** Subscribes and returns the unsubscribe function. The scene calls it on mount. */
export function subscribeSphere(
  listener: (state: SphereState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
