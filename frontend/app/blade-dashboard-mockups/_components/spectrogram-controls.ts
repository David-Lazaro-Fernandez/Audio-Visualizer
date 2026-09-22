"use client";

import type { TuningSpec } from "@/app/_ui/TuningPanel";

/**
 * Live tuning for the spectrogram visualizer (DESIGN.md §6.16).
 *
 * This is a module-level store and not React state, for the same reason
 * as `blade-water-controls.ts`: a three.js scene in a `useEffect` reads
 * these values, not a component tree, and a change to a number must not
 * rebuild the scene. The flow is one-way, the panel writes and the
 * scene reads and subscribes, thus a render loop is not possible.
 *
 * The store holds angles and not a camera position, because a user can
 * reason about "azimuth 20 degrees" and cannot reason about
 * `(-7, 9, 20)`. The projection is orthographic, thus the distance to
 * the target changes nothing and the panel does not show it.
 */

export const SPECTROGRAM_SPECS = {
  rows: {
    label: "History rows",
    min: 8,
    max: 96,
    step: 1,
    primary: true,
    hint: "How many snapshots are kept. Rows x interval is the span of time shown",
  },
  intervalMs: {
    label: "Row interval (ms)",
    min: 20,
    max: 300,
    step: 5,
    primary: true,
    hint: "How often a new snapshot is laid down; shorter packs the rows closer in time",
  },
  peakY: {
    label: "Peak height",
    min: 1,
    max: 20,
    step: 0.25,
    primary: true,
    hint: "World height of a band at full energy",
  },
  azimuth: {
    label: "Camera azimuth",
    min: -80,
    max: 80,
    step: 1,
    primary: true,
    hint: "Degrees around the scene. 0 is dead ahead; side-on makes the time and frequency axes hard to tell apart",
  },
  elevation: {
    label: "Camera elevation",
    min: 2,
    max: 80,
    step: 1,
    primary: true,
    hint: "Degrees above the plane. Low looks along the rows, high looks down on them",
  },
  spanX: {
    label: "Frequency width",
    min: 6,
    max: 40,
    step: 0.5,
    hint: "World width the 28 bands are spread across",
  },
  rowGap: {
    label: "Row spacing",
    min: 0.1,
    max: 2,
    step: 0.05,
    hint: "World depth between consecutive rows",
  },
  fade: {
    label: "Trail fade",
    min: 0.4,
    max: 4,
    step: 0.1,
    hint: "How sharply older rows dim. Higher fades them sooner",
  },
  brightness: {
    label: "Brightness",
    min: 0.2,
    max: 3,
    step: 0.05,
    hint: "Overall line brightness; the lines blend additively, so this bites fast",
  },
  marginPct: {
    label: "Fit margin (%)",
    min: 0,
    max: 40,
    step: 1,
    hint: "Breathing room left around the rows. Lower fills more of the panel",
  },
} as const satisfies Record<string, TuningSpec>;

export type SpectrogramKey = keyof typeof SPECTROGRAM_SPECS;
export type SpectrogramState = Record<SpectrogramKey, number>;

/** The panel order: the five knobs with the largest effect first, then the others. */
export const SPECTROGRAM_KEYS = Object.keys(SPECTROGRAM_SPECS) as SpectrogramKey[];

export const SPECTROGRAM_DEFAULTS: SpectrogramState = {
  rows: 48,
  intervalMs: 70,
  peakY: 7,
  azimuth: 13,
  elevation: 13,
  spanX: 18,
  rowGap: 0.45,
  fade: 1.7,
  brightness: 1,
  marginPct: 5,
};

let state: SpectrogramState = { ...SPECTROGRAM_DEFAULTS };
const listeners = new Set<(state: SpectrogramState) => void>();

/** The current values, for a scene that starts now. */
export function spectrogramState(): Readonly<SpectrogramState> {
  return state;
}

export function setSpectrogramControl(key: SpectrogramKey, value: number) {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  for (const listener of listeners) listener(state);
}

export function resetSpectrogramControls() {
  state = { ...SPECTROGRAM_DEFAULTS };
  for (const listener of listeners) listener(state);
}

/** Subscribes and returns the unsubscribe function. The scene calls it on mount. */
export function subscribeSpectrogram(
  listener: (state: SpectrogramState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
