/**
 * Noise primitives, as GLSL, shared by everything that needs a field.
 *
 * Gradient noise on an integer lattice rather than simplex. Simplex is
 * faster in principle but fiddly to get right from memory, and these run
 * on the GPU where the difference does not show.
 *
 * Extracted when the raymarcher became the third consumer, after the
 * curl noise field and its potential. One implementation means one place
 * for a hash to be wrong in.
 *
 * Keep this ASCII-only: WebGL rejects shader source containing
 * characters outside the GLSL ES set, comments included, and reports it
 * before the compiler runs - so the failure arrives as a compile error
 * with a null info log rather than a readable message.
 */
export const NOISE_CHUNK = /* glsl */ `
/** One float of noise from an index, for per-item jitter. */
float hash11(float n) {
  return fract(sin(n * 78.233) * 43758.5453123);
}

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

/** Gradient noise: random gradients on the lattice, smoothstep between. */
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(dot(hash33(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
          dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
      mix(dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
          dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x),
      u.y),
    mix(
      mix(dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
          dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
      mix(dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
          dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x),
      u.y),
    u.z);
}

/**
 * Fractal sum of 'octaves' layers of gradient noise, each half the
 * amplitude at twice the frequency. Normalised so the result stays in
 * about -1..1 whatever the octave count.
 */
float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    sum += gnoise(p) * amplitude;
    total += amplitude;
    p *= 2.02;            // slightly off 2, so lattices do not align
    amplitude *= 0.5;
  }
  return sum / max(total, 1e-5);
}
`;
