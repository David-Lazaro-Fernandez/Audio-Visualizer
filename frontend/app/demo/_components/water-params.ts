/**
 * The view of the water on the `/demo` page: its palette, its constants
 * on the camera side and its toggles. The blade dashboard background
 * shares the numeric wave parameters, thus they are in
 * `@/app/_water/water-params`. This file re-exports them, thus each
 * import of this page reads from one place.
 */

export {
  WATER_PARAMS,
  WATER_DEFAULTS,
  type WaterParamSpec,
  type WaterParamKey,
} from "@/app/_water/water-params";

export const WATER_COLORS = {
  deep: "#0b2a44",
  horizon: "#3b7fb3",
  zenith: "#e8f4ff",
} as const;

/** Spec section 9. The shader normalizes it, thus the magnitude is free. */
export const LIGHT_DIR = [0.3, 1.0, 0.2] as const;

/** The switches that are not numbers, together, thus the panel can list them. */
export interface WaterToggles {
  /** 0 = glossy shaded, 1 = height / contour (uMode). */
  heightView: boolean;
  /** Sum over 4 wavenumbers instead of one carrier (spec section 10). */
  dispersion: boolean;
  /** Coarse wireframe overlay for the technical read (spec section 6). */
  wireframe: boolean;
  /** Continue to drop on a timer, thus the surface is never static. */
  autoDrops: boolean;
}

export const TOGGLE_DEFAULTS: WaterToggles = {
  heightView: false,
  dispersion: false,
  wireframe: false,
  autoDrops: true,
};

/** Plane size in world units, and the two grid densities (spec section 6). */
export const PLANE_SIZE = 40;
export const PLANE_SEGMENTS = 512;
export const WIRE_SEGMENTS = 128;

/**
 * Length of the ring buffer. It comes from the shared field module, thus
 * this page and the blade background always agree with the
 * `#define MAX_DROPS` of the shader.
 */
export { MAX_DROPS } from "@/app/_water/water-field";
/** This page drops on a click and on a timer, thus it keeps the default. */
export { DEFAULT_DROP_CAPACITY } from "@/app/_water/water-field";
