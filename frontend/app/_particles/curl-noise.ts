import { NOISE_CHUNK } from "@/app/_glsl/noise";

/**
 * Curl noise, as GLSL, for the particle flow field.
 *
 * A curl noise velocity field is the curl of a vector potential, and a
 * curl is always divergence-free. This is the reason to use it: a
 * divergence-free field has no sources and no sinks, thus the particles
 * that it carries do not collect in a corner or drain out of one. Three
 * noise fields read directly as a velocity look correct for a second and
 * then clump.
 *
 * The noise is gradient noise on an integer lattice, not simplex noise.
 * Simplex noise is faster, but it is more difficult to write correctly,
 * and the full evaluation runs on the GPU, where the difference does not
 * show. The curl needs six samples of a potential with three components,
 * thus 18 noise calls for each particle for each frame. For a 160x160
 * pool this is near 460k calls a frame, which is a small cost.
 *
 * Use only ASCII characters. Refer to `noise.ts` for the reason.
 */
export const CURL_NOISE_CHUNK = /* glsl */ `
${NOISE_CHUNK}
/** Three decorrelated noise fields, read as a vector potential. */
vec3 potential(vec3 p) {
  return vec3(gnoise(p), gnoise(p + 31.416), gnoise(p - 17.234));
}

/** Curl of that potential, by central differences. */
vec3 curlNoise(vec3 p, float eps) {
  vec3 dx = vec3(eps, 0.0, 0.0);
  vec3 dy = vec3(0.0, eps, 0.0);
  vec3 dz = vec3(0.0, 0.0, eps);

  vec3 px0 = potential(p - dx);
  vec3 px1 = potential(p + dx);
  vec3 py0 = potential(p - dy);
  vec3 py1 = potential(p + dy);
  vec3 pz0 = potential(p - dz);
  vec3 pz1 = potential(p + dz);

  return vec3(
    (py1.z - py0.z) - (pz1.y - pz0.y),
    (pz1.x - pz0.x) - (px1.z - px0.z),
    (px1.y - px0.y) - (py1.x - py0.x)
  ) / (2.0 * eps);
}
`;
