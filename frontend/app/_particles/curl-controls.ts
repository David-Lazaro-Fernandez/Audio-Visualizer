"use client";

import type { TuningSpec } from "@/app/_ui/TuningPanel";

/**
 * Live tuning for the curl-noise flow field.
 *
 * It uses the same one-way store as the other overlays: the panel writes,
 * the scene reads and subscribes. Thus a slider does not tear down the
 * simulation.
 *
 * These knobs shape a field, not a trajectory as the analytic sphere
 * does, thus they change each particle at the same time and no
 * per-particle constant delays them. This also makes the drift worth
 * running: the full cloud answers, thus the field breathes. If it did
 * not, only the new particles would behave differently from the
 * particles that are already out there.
 *
 * The minimums are not zero. They are the values below which the field
 * shows almost nothing. They were found by tuning, thus they are on the
 * specs and not in a comment: the slider cannot go below them, and the
 * drift cannot either, because the walk clamps and bounces on the same
 * bounds.
 *
 * Each knob has a `driftScale`, relative to the drift rate, because the
 * knobs do not accept the same movement. The curl strength can move a
 * long way and stay attractive, but the emission floor makes the density
 * jump if it moves much.
 */
export const CURL_SPECS = {
  radial: {
    label: "Outward push",
    min: 4.8,
    max: 30,
    step: 0.25,
    primary: true,
    driftScale: 1,
    hint: "World units a second a full-brightness particle is pushed away from the centre",
  },
  curlStrength: {
    label: "Curl strength",
    min: 3.8,
    max: 20,
    step: 0.25,
    primary: true,
    driftScale: 1,
    hint: "How hard the flow field drags particles sideways. Zero is a plain radial burst",
  },
  curlScale: {
    label: "Curl scale",
    min: 0.245,
    max: 0.5,
    step: 0.005,
    primary: true,
    driftScale: 1,
    hint: "Spatial frequency of the field. Small makes wide slow eddies, large makes tight turbulence",
  },
  life: {
    label: "Lifetime (s)",
    min: 2.2,
    max: 10,
    step: 0.1,
    primary: true,
    driftScale: 0.8,
    hint: "Decay time of a particle's brightness. Longer leaves longer trails of shells",
  },
  floor: {
    label: "Emission floor",
    min: 0.1,
    max: 0.5,
    step: 0.01,
    primary: true,
    driftScale: 0.5,
    hint: "Bands quieter than this do not respawn their particles, so the cloud thins",
  },
  flow: {
    label: "Field drift",
    min: 0,
    max: 1.5,
    step: 0.01,
    driftScale: 1,
    hint: "How fast the field itself evolves, so the eddies move rather than sitting still",
  },
  core: {
    label: "Core radius",
    min: 0,
    max: 12,
    step: 0.1,
    driftScale: 0.8,
    hint: "Radius particles are born on",
  },
  spread: {
    label: "Ring spread",
    min: 0,
    max: 1,
    step: 0.01,
    driftScale: 1,
    hint: "How much a band's particles scatter off its own latitude at birth",
  },
  gain: {
    label: "Colour gain",
    min: 0.4,
    max: 1.5,
    step: 0.05,
    primary: true,
    driftScale: 0.5,
    hint: "Per-particle brightness. The points blend additively, so the dense core is a sum and this saturates to white fast",
  },
  size: {
    label: "Particle size",
    min: 0.5,
    max: 8,
    step: 0.1,
    driftScale: 0.6,
    hint: "Point size before brightness scales it",
  },
} as const satisfies Record<string, TuningSpec>;

export type CurlKey = keyof typeof CURL_SPECS;
export type CurlState = Record<CurlKey, number>;

export const CURL_KEYS = Object.keys(CURL_SPECS) as CurlKey[];

export const CURL_DEFAULTS: CurlState = {
  radial: 6,
  curlStrength: 3.8,
  curlScale: 0.245,
  life: 2.6,
  floor: 0.1,
  flow: 0.15,
  core: 2.4,
  spread: 0.06,
  gain: 0.45,
  size: 1.6,
};

/** How often the field drifts, in ms. */
export const CURL_DRIFT_MS = 1000;

let state: CurlState = { ...CURL_DEFAULTS };
const listeners = new Set<(state: CurlState) => void>();

/**
 * Whether the field wanders without input. It is on by default. It is a
 * separate channel and not one of the knobs above, because it is not a
 * number and does not fit a `Record<K, number>`.
 *
 * It is in the store and not in the panel, because the panel is not
 * always present. The dashboard hides each tuning overlay, because a
 * 10-foot UI has no controls, and the drift must still run in that
 * visualizer. Thus the scene drives the drift and the panel is only a
 * switch on it.
 */
let drifting = true;
const driftListeners = new Set<(on: boolean) => void>();

export function curlDrifting() {
  return drifting;
}

export function setCurlDrifting(on: boolean) {
  if (drifting === on) return;
  drifting = on;
  for (const listener of driftListeners) listener(on);
}

export function subscribeCurlDrifting(
  listener: (on: boolean) => void,
): () => void {
  driftListeners.add(listener);
  return () => driftListeners.delete(listener);
}

export function curlState(): Readonly<CurlState> {
  return state;
}

export function setCurlControl(key: CurlKey, value: number) {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  for (const listener of listeners) listener(state);
}

export function resetCurlControls() {
  state = { ...CURL_DEFAULTS };
  for (const listener of listeners) listener(state);
}

export function subscribeCurl(listener: (state: CurlState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
