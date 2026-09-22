/**
 * GLSL noise primitives. Each field that needs noise uses this chunk.
 *
 * The noise is gradient noise on an integer lattice, not simplex noise.
 * Simplex noise is faster, but it is more difficult to write correctly.
 * These functions run on the GPU, where the difference does not show.
 *
 * The curl noise field, its potential and the raymarcher all use the
 * chunk. One implementation keeps the hashes correct in one place.
 *
 * Use only ASCII characters. WebGL rejects shader source that contains
 * characters outside the GLSL ES set, comments included. It rejects the
 * source before the compiler runs, so the error has a null info log and
 * no readable message.
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

/** Gradient noise: random gradients on the lattice, smoothstep between them. */
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
 * Fractal sum of 'octaves' layers of gradient noise. Each layer has half
 * the amplitude and twice the frequency of the layer before it. The sum
 * is normalised, thus the result stays near -1..1 at all octave counts.
 */
float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    sum += gnoise(p) * amplitude;
    total += amplitude;
    p *= 2.02;            // not exactly 2, thus the lattices do not align
    amplitude *= 0.5;
  }
  return sum / max(total, 1e-5);
}
`;
