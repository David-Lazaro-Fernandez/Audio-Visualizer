import { NOISE_CHUNK } from "@/app/_glsl/noise";

/**
 * Curl noise, as GLSL, for the particle flow field.
 *
 * A curl noise velocity field is the curl of a vector potential, and the
 * curl of anything is **divergence-free**. That is the whole reason to
 * use it: a divergence-free field has no sources and no sinks, so
 * particles carried by it never pile up in a corner or drain out of one.
 * Sampling three noise fields straight into a velocity would look
 * plausible for a second and then clump.
 *
 * Gradient noise on an integer lattice rather than simplex. Simplex is
 * faster in principle but fiddly to get right from memory, and the whole
 * evaluation runs on the GPU where the difference does not show: the
 * curl needs six samples of a three-component potential, so eighteen
 * noise calls per particle per frame — about 460k a frame for a 160x160
 * pool, which is nothing.
 *
 * Keep this ASCII-only: WebGL rejects shader source containing
 * characters outside the GLSL ES set, comments included, and reports it
 * before the compiler runs.
 */
export const CURL_NOISE_CHUNK = /* glsl */ `
${NOISE_CHUNK}
/** Three decorrelated noise fields, read as a vector potential. */
vec3 potential(vec3 p) {
  return vec3(gnoise(p), gnoise(p + 31.416), gnoise(p - 17.234));
}

/**
 * Curl of that potential, by central differences.
 *
 * Divergence-free by construction, whatever the noise underneath is -
 * which is why the field is built this way rather than by sampling three
 * noises straight into a velocity.
 */
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
