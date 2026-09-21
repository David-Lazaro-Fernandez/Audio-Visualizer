/**
 * The `/demo` page's view of the water: its palette, its camera-side
 * constants and its toggles. The numeric wave parameters themselves are
 * shared with the blade dashboard background and live in
 * `@/app/_water/water-params`; they are re-exported here so this page's
 * imports all read from one place.
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

/** Spec section 9. Normalized in the shader, so the magnitude is free. */
export const LIGHT_DIR = [0.3, 1.0, 0.2] as const;

/** The non-numeric switches, kept together so the panel can list them. */
export interface WaterToggles {
  /** 0 = glossy shaded, 1 = height / contour (uMode). */
  heightView: boolean;
  /** Sum over 4 wavenumbers instead of one carrier (spec section 10). */
  dispersion: boolean;
  /** Coarse wireframe overlay for the technical read (spec section 6). */
  wireframe: boolean;
  /** Keep dropping on a timer so the surface is never static. */
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
 * Ring buffer length. Re-exported from the shared field module so this
 * page and the blade background can never disagree with the shader's
 * `#define MAX_DROPS`.
 */
export { MAX_DROPS } from "@/app/_water/water-field";
