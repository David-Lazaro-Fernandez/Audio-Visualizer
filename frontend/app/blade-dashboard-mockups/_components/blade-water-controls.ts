/**
 * The live tuning channel for the water of the blade background.
 *
 * This is a module-level store and not React context, for the same
 * reason as `back-stack.ts`: the readers are not React components. They
 * are `BladeWaterRenderer` instances, and several can run at the same
 * time. The blade canvas and each full-screen surface above it (§5.4)
 * has its own WebGL context. A store lets one slider drive all of them,
 * and it lets a surface that mounts later use the values on the screen
 * instead of the defaults.
 *
 * The flow is one-way: the panel writes, and the renderers read and
 * subscribe. Thus `useSyncExternalStore` is not necessary and a render
 * loop is not possible.
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
 * Whether the tuning overlay is mounted (`page.tsx`). It is off. The
 * dashboard is a 10-foot UI and has no controls (§8), thus you switch
 * the panel on to tune the background, then switch it off. The store
 * below works in both conditions: the renderers read it also when
 * nothing writes to it.
 */
export const SHOW_WATER_CONTROLS: boolean = false;

export type BladeWaterKey = WaterParamKey | BladeWaterControlKey;
export type BladeWaterState = Record<BladeWaterKey, number>;

/**
 * The contour frequency is the one wave parameter that this surface does
 * not use, because a dashboard has no height and contour view. Thus the
 * panel does not show it, and there is no slider that does nothing.
 */
const HIDDEN: ReadonlySet<string> = new Set(["uContourFreq"]);

/** The panel order: the knobs of this surface first, then the wave model. */
export const BLADE_WATER_KEYS: BladeWaterKey[] = [
  ...(Object.keys(BLADE_WATER_CONTROLS) as BladeWaterControlKey[]),
  ...(Object.keys(WATER_PARAMS) as WaterParamKey[]).filter(
    (key) => !HIDDEN.has(key),
  ),
];

/** The type annotation makes `primary` optional for the panel. Without
 * it, TypeScript reads `primary` as a literal on only some members. */
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

/** The current values, for a renderer that starts now. */
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

/** Subscribes and returns the unsubscribe function. A renderer calls it from its constructor. */
export function subscribeBladeWater(
  listener: (state: BladeWaterState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
