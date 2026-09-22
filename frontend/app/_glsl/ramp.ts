/**
 * The app's four-stop colour ramp, as GLSL.
 *
 * Blue, violet, amber, red - the same progression the LED matrix uses
 * for its rows (DESIGN.md §6.16), so the whole player reads as one
 * instrument even though each visualizer decides for itself what the
 * ramp *means*: level on the matrix, frequency in the curl field, the
 * spectral centroid on the raymarched core. The stops are the shared
 * part; the argument is not.
 *
 * Extracted when the core became its second GLSL consumer. Two copies
 * of a palette drift apart, and DESIGN.md calls this one thing.
 *
 * Keep this ASCII-only, for the reason given in `noise.ts`.
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
