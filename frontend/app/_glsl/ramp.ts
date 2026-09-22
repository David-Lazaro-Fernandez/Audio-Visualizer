/**
 * The four-stop colour ramp of the app, as GLSL.
 *
 * The stops are blue, violet, amber and red. The LED matrix uses the same
 * stops for its rows (DESIGN.md §6.16), thus the player reads as one
 * instrument. Each visualizer decides what the ramp shows: level on the
 * matrix, frequency in the curl field and the spectral centroid on the
 * raymarched core. Only the stops are shared.
 *
 * The core was the second GLSL consumer of the ramp. Two copies of a
 * palette move apart, and DESIGN.md gives only one ramp.
 *
 * Use only ASCII characters. Refer to `noise.ts` for the reason.
 */
export const RAMP_CHUNK = /* glsl */ `
vec3 ramp(float t) {
  vec3 blue   = vec3(0.298, 0.780, 1.000);
  vec3 violet = vec3(0.706, 0.361, 1.000);
  vec3 amber  = vec3(1.000, 0.541, 0.239);
  vec3 red    = vec3(1.000, 0.231, 0.188);
  if (t < 0.40) return mix(blue, violet, t / 0.40);
  if (t < 0.72) return mix(violet, amber, (t - 0.40) / 0.32);
  return mix(amber, red, clamp((t - 0.72) / 0.28, 0.0, 1.0));
}
`;
