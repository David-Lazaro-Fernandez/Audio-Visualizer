/**
 * The parameters of the wave field: one table that gives each surface its
 * initial uniform values, its slider panel and its reset button.
 *
 * The table is shared because two panels now control the same field: the
 * panel of the `/demo` page and the tuning overlay of the blade
 * dashboard. A knob that is in one panel and not in the other is a knob
 * that drifts. Each numeric value that the shader reads belongs here.
 * View-level choices, such as colors, camera and plane size, stay with
 * the surface that owns them.
 */

export interface WaterParamSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  /** Shown before the fold: the knobs with the highest priority. */
  primary?: boolean;
  /** What the knob does. The panel shows it as title text. */
  hint: string;
}

/**
 * Wavelength lambda = 2*pi/uK, so uK 5.2 gives lambda ~= 1.2 world units.
 * Ring count is roughly sigma*k/pi, which puts uSigma0 2.5 at ~4 rings.
 */
export const WATER_PARAMS = {
  uK: { label: "Wavenumber k", min: 1, max: 14, step: 0.05, primary: true, hint: "2*pi/lambda: more means finer rings" },
  uSpeed: { label: "Front speed c", min: 1, max: 20, step: 0.1, primary: true, hint: "How fast the wavefront travels outward" },
  uSigma0: { label: "Packet width sigma0", min: 0.3, max: 8, step: 0.05, primary: true, hint: "Ring count is about sigma*k/pi" },
  uTau: { label: "Fade tau", min: 0.2, max: 8, step: 0.05, primary: true, hint: "How long a ripple lives" },
  uHeightScale: { label: "Height scale", min: 0, max: 6, step: 0.05, primary: true, hint: "Visual exaggeration of the whole field" },

  uAmp: { label: "Amplitude A", min: 0, max: 0.6, step: 0.005, hint: "Ripple height before exaggeration" },
  uSigmaGrowth: { label: "Packet growth", min: 0, max: 3, step: 0.02, hint: "How fast the packet widens as it travels" },
  uViscosity: { label: "Viscosity nu", min: 0, max: 0.06, step: 0.0005, hint: "Damps short waves faster than long ones" },
  uR0: { label: "Spread softening r0", min: 0.05, max: 4, step: 0.05, hint: "Softens the 1/sqrt(r) spike at the impact point" },
  uQuiet: { label: "Quiet radius", min: 0, max: 8, step: 0.05, primary: true, hint: "Hides each drop within this radius, so only the travelling wave shows" },

  uJetB: { label: "Jet height", min: 0, max: 4, step: 0.02, hint: "Height of the rebound column" },
  uJetS: { label: "Jet width", min: 0.05, max: 1.5, step: 0.01, hint: "Radius of the crater and jet" },
  uJetTau: { label: "Jet peak time", min: 0.02, max: 0.6, step: 0.005, hint: "When the jet reaches its peak" },
  uCraterC: { label: "Crater depth", min: 0, max: 2, step: 0.02, hint: "How far the surface dips before rebounding" },
  uCraterTau: { label: "Crater recovery", min: 0.01, max: 0.4, step: 0.005, hint: "How fast the crater fills back in" },

  uContourFreq: { label: "Contour frequency", min: 2, max: 80, step: 1, hint: "Contour lines per unit of height, in height view" },
  uGravity: { label: "Dispersion g", min: 0.05, max: 6, step: 0.05, hint: "Gravity term in the dispersion relation" },
  uCapillary: { label: "Dispersion gamma", min: 0, max: 2, step: 0.01, hint: "Surface-tension term: makes short waves outrun long ones" },
} as const satisfies Record<string, WaterParamSpec>;

export type WaterParamKey = keyof typeof WATER_PARAMS;

/** Spec section 9, plus the two dispersion terms from section 10. */
export const WATER_DEFAULTS: Record<WaterParamKey, number> = {
  uAmp: 0.15,
  uK: 5.2,
  uSpeed: 8.0,
  uSigma0: 2.5,
  uSigmaGrowth: 0.6,
  uTau: 2.0,
  uViscosity: 0.005,
  uR0: 1.0,
  uQuiet: 0,
  uJetB: 1.2,
  uJetS: 0.25,
  uJetTau: 0.12,
  uCraterC: 0.4,
  uCraterTau: 0.06,
  uHeightScale: 1.0,
  uContourFreq: 20,
  uGravity: 1.0,
  uCapillary: 0.4,
};
