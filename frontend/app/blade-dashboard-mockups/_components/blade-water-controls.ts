/**
 * The live tuning channel for the blade background's water.
 *
 * A module-level store rather than React context, for the same reason
 * `back-stack.ts` is one: the things that need these values are not React
 * components. They are `BladeWaterRenderer` instances, and there can be
 * several at once - the blade canvas plus every full-screen surface
 * stacked over it (§5.4), each with its own WebGL context. A store lets
 * one slider drive all of them, and lets a surface that mounts later pick
 * up the values already on screen instead of snapping back to the
 * defaults.
 *
 * Strictly one-way: the panel writes, renderers read and subscribe. So
 * there is no need for `useSyncExternalStore` and no risk of a render
 * loop.
 */

import {
  WATER_PARAMS,
  type WaterParamKey,
  type WaterParamSpec,
} from "@/app/_water/water-params";
import {
  BLADE_WATER_CONTROLS,
  BLADE_WATER_PARAMS,
  DROP_INTERVAL,
  RELIEF_GAIN,
  RELIEF_OPACITY,
  TILT_Z_DEG,
  type BladeWaterControlKey,
} from "./blade-water";

/**
 * Whether the tuning overlay is mounted at all (`page.tsx`). Off: the
 * dashboard is a 10-foot UI and has no controls (§8), so the panel is a
 * thing you switch on to tune the background and switch off again. The
 * store below still works either way - the renderers read it whether or
 * not anything is writing to it.
 */
export const SHOW_WATER_CONTROLS: boolean = false;

export type BladeWaterKey = WaterParamKey | BladeWaterControlKey;
export type BladeWaterState = Record<BladeWaterKey, number>;

/**
 * Contour frequency is the one wave parameter this surface has no use
 * for - there is no height/contour view on a dashboard - so it is kept
 * out of the panel rather than shown as a slider that does nothing.
 */
const HIDDEN: ReadonlySet<string> = new Set(["uContourFreq"]);

/** Panel order: this surface's own knobs first, then the wave model. */
export const BLADE_WATER_KEYS: BladeWaterKey[] = [
  ...(Object.keys(BLADE_WATER_CONTROLS) as BladeWaterControlKey[]),
  ...(Object.keys(WATER_PARAMS) as WaterParamKey[]).filter(
    (key) => !HIDDEN.has(key),
  ),
];

/** Annotated so the panel reads `primary` as optional rather than as a
 * literal present on only half the members. */
export const BLADE_WATER_SPECS: Record<BladeWaterKey, WaterParamSpec> = {
  ...WATER_PARAMS,
  ...BLADE_WATER_CONTROLS,
};

function defaults(): BladeWaterState {
  const state = {} as BladeWaterState;
  for (const key of BLADE_WATER_KEYS) {
    state[key] = BLADE_WATER_PARAMS[key] ?? 0;
  }
  state.tiltZDeg = TILT_Z_DEG;
  state.uRelief = RELIEF_GAIN;
  state.uOpacity = RELIEF_OPACITY;
  state.dropInterval = DROP_INTERVAL;
  return state;
}

export const BLADE_WATER_DEFAULTS: BladeWaterState = defaults();

let state: BladeWaterState = { ...BLADE_WATER_DEFAULTS };
const listeners = new Set<(state: BladeWaterState) => void>();

/** The values as they stand, for a renderer that has just been built. */
export function bladeWaterState(): Readonly<BladeWaterState> {
  return state;
}

export function setBladeWaterControl(key: BladeWaterKey, value: number) {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  for (const listener of listeners) listener(state);
}

export function resetBladeWaterControls() {
  state = { ...BLADE_WATER_DEFAULTS };
  for (const listener of listeners) listener(state);
}

/** Returns an unsubscribe. Renderers call this from their constructor. */
export function subscribeBladeWater(
  listener: (state: BladeWaterState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
