/**
 * The wave field: the GLSL every water surface in this app shares, plus
 * the CPU-side drop bookkeeping that feeds it.
 *
 * Two surfaces use it — the `/demo` page, which shades it as glossy water,
 * and the blade dashboard background, which composites only its relief
 * over the section gradient. They differ entirely in their *fragment*
 * shaders; the height field, its analytic radial derivative and the
 * displacement pass are identical, so they live here once.
 *
 * The model is a Gaussian-enveloped radial wave packet plus a separate
 * center jet, superposed over up to MAX_DROPS drops because the model is
 * linear. The derivative travels alongside the height and is computed
 * analytically so the fragment shader can build an exact normal rather
 * than differencing neighbours: the rings read through the reflection
 * angle, not the silhouette, and screen-space derivatives come out
 * faceted at any sane mesh density.
 *
 * **ASCII only.** WebGL rejects shader source containing characters
 * outside the GLSL ES source character set, comments included, and it
 * rejects it in `shaderSource` before the compiler runs - so the failure
 * arrives as a compile error with a null info log. The math below is
 * commented with `sigma`, `tau`, `nu`, `lambda` rather than the Greek
 * letters the model is usually written with.
 *
 * three.js compiles any non-RawShaderMaterial as GLSL ES 3.00 and aliases
 * `varying` and `gl_FragColor`, so `glslVersion` is left unset and
 * `fwidth` is core.
 */

/**
 * Size of the shader's drop array — the *ceiling*, not what any one
 * surface uses.
 *
 * `surface()` breaks out of its loop at `uDropCount`, so a surface pays
 * for the drops it actually holds and nothing for the empty tail. That
 * makes the array cheap to oversize, and it has to be oversized: the
 * audio visualizer needs dozens of simultaneous ripples, because
 * `uDropCount` slots divided by a ripple's two-second life is the only
 * drop rate it can sustain without recycling a wave that is still
 * visible. Sixteen slots at a busy passage's rate recycled a slot every
 * 110 ms, which chopped every ripple almost as soon as it started.
 *
 * Surfaces that drop slowly — the blade background, `/demo` — declare a
 * smaller capacity of their own and keep their original cost.
 */
export const MAX_DROPS = 48;

/** What a surface uses unless it says otherwise. */
export const DEFAULT_DROP_CAPACITY = 16;

/**
 * A `uDropK` array that means "every drop uses uK". Every surface needs
 * this: an unassigned uniform array reads as zero, and k = 0 flattens the
 * field entirely. Only the audio visualizer writes anything else.
 */
export const flatDropK = () => new Float32Array(MAX_DROPS).fill(1);

/**
 * The wave math, injected into both stages of both surfaces.
 *
 * `uLift` and `uAlpha` are here rather than in a fragment shader because
 * a wireframe overlay shares these exact sources and needs to sit above
 * the surface it traces; both are inert at 0 and 1.
 */
export const WATER_FIELD_CHUNK = /* glsl */ `
#define MAX_DROPS ${MAX_DROPS}
#define DISP_MODES 4

uniform float uTime;
uniform int   uDropCount;
uniform vec4  uDrops[MAX_DROPS];   // xy: origin (world x,z), z: start time, w: strength
/**
 * Per-drop wavenumber, as a *multiplier* of uK rather than an absolute
 * value. A vec4 has no room left for it, and a multiplier means the
 * array never has to be resynchronised when uK itself is adjusted: 1.0
 * is "whatever uK says", which is what every surface but the audio
 * visualizer wants. Driving it per drop is what lets a bass onset make
 * long, wide rings and a cymbal make tight ones.
 */
uniform float uDropK[MAX_DROPS];

uniform float uAmp;          // ripple amplitude A
uniform float uK;            // wavenumber 2*pi/lambda
uniform float uSpeed;        // front speed c
uniform float uSigma0;
uniform float uSigmaGrowth;
uniform float uTau;
uniform float uViscosity;    // nu
uniform float uR0;
uniform float uJetB, uJetS, uJetTau, uCraterC, uCraterTau;
uniform float uHeightScale;  // visual exaggeration

uniform float uDispersion;   // 0 = single carrier, 1 = sum over wavenumbers
uniform float uGravity;      // g in the dispersion relation
uniform float uCapillary;    // gamma in the dispersion relation

uniform float uQuiet;        // radius inside which a drop is not drawn
uniform float uLift;         // lifts a wireframe overlay off the surface
uniform float uAlpha;        // < 1 only for that overlay

/**
 * The single-carrier ripple packet: (height, dh/dr).
 *
 * env kills everything but the rings near the wavefront, which is what
 * keeps the water flat ahead of the front (nothing has arrived) and flat
 * behind the packet (it has settled). spread is geometric spreading on a
 * 2D surface; decay is the global fade times viscous damping, which eats
 * short waves faster than long ones.
 */
vec2 ripplePacket(float r, float t, float strength, float k) {
  float u      = r - uSpeed * t;     // distance behind the wavefront
  float sigma  = uSigma0 + uSigmaGrowth * t;
  float s2     = sigma * sigma;
  float env    = exp(-(u * u) / (2.0 * s2));
  float rr     = r + uR0;
  float spread = inversesqrt(rr);
  // Viscous damping goes as k^2, so a short-wavelength drop dies faster
  // than a long one all on its own - which is physically right and is
  // exactly what makes a cymbal's ripple brief and a kick's linger.
  float decay  = exp(-t / uTau) * exp(-2.0 * uViscosity * k * k * t);
  float amp    = uAmp * strength * decay * env * spread;
  float sn = sin(k * u);
  float cs = cos(k * u);
  return vec2(
    amp * cs,
    amp * (-k * sn - (u / s2 + 0.5 / rr) * cs)
  );
}

/**
 * Dispersive ripple packet. Real ripples sort by wavelength: short
 * capillary waves run ahead, which is what puts the fine rings on the
 * outside. Each mode gets its own group velocity from the dispersion
 * relation, so the single envelope splits into several that separate over
 * time. The derivative is the same product rule as above, with the phase
 * now k*r - omega*t.
 */
vec2 rippleDispersive(float r, float t, float strength, float carrier) {
  float rr     = r + uR0;
  float spread = inversesqrt(rr);
  float sigma  = uSigma0 + uSigmaGrowth * t;
  float s2     = sigma * sigma;
  vec2 acc = vec2(0.0);
  for (int i = 0; i < DISP_MODES; i++) {
    float kf    = 0.6 + 0.6 * float(i);          // 0.6x .. 2.4x the carrier
    float k     = carrier * kf;
    float omega = sqrt(uGravity * k + uCapillary * k * k * k);
    float cg    = (uGravity + 3.0 * uCapillary * k * k) / (2.0 * omega);
    float u     = r - cg * t;                    // the envelope rides c_g
    float env   = exp(-(u * u) / (2.0 * s2));
    float decay = exp(-t / uTau) * exp(-2.0 * uViscosity * k * k * t);
    float amp   = uAmp * strength * decay * env * spread / (float(DISP_MODES) * kf);
    float phase = k * r - omega * t;
    float sn = sin(phase);
    float cs = cos(phase);
    acc.x += amp * cs;
    acc.y += amp * (-k * sn - (u / s2 + 0.5 / rr) * cs);
  }
  return acc;
}

/**
 * (height, dh/dr) for one drop: the ripple packet plus the center jet.
 *
 * The jet is not a solution of the wave equation, it is a separate term.
 * B(t) goes negative first (the crater the drop punches) and then
 * positive (the rebound column that pinches off a secondary droplet).
 */
vec2 dropField(float r, float t, float strength, float k) {
  vec2 acc = uDispersion > 0.5
    ? rippleDispersive(r, t, strength, k)
    : ripplePacket(r, t, strength, k);

  float B = uJetB * (t / uJetTau) * exp(1.0 - t / uJetTau)
          - uCraterC * exp(-t / uCraterTau);
  float g = exp(-(r * r) / (2.0 * uJetS * uJetS));
  float j = strength * B * g;
  acc.x += j;
  acc.y += j * (-r / (uJetS * uJetS));

  // Hide the impact and keep only the travelling wave. Inside uQuiet a
  // drop contributes nothing, which removes two different things at once:
  // the crater/jet spike, which lives at r = 0 forever, and the newborn
  // packet, whose whole amplitude sits inside r ~ sigma0 before it has
  // spread. Because the front advances as r = c*t, a gate in r is also a
  // fade-in in time, so a drop swells into view instead of appearing.
  //
  // The derivative has to follow the product rule or the normals - which
  // are what the surface is actually shaded by - would disagree with the
  // height. smoothstep's derivative is analytic, so this stays exact.
  // Zero disables the gate, which is the default everywhere but the
  // dashboard background.
  if (uQuiet > 0.0) {
    float x     = clamp(r / uQuiet, 0.0, 1.0);
    float gate  = x * x * (3.0 - 2.0 * x);
    float dGate = 6.0 * x * (1.0 - x) / uQuiet;
    acc.y = dGate * acc.x + gate * acc.y;
    acc.x = gate * acc.x;
  }

  return acc;
}

/**
 * (height, dh/dx, dh/dz) at a world xz, already height-scaled so the
 * gradient and the height can never disagree about the exaggeration.
 *
 * The loop bound is the compile-time MAX_DROPS with an early break, not
 * the uniform, because a uniform loop bound is not portable. r is clamped
 * before the division or the impact point itself comes out NaN.
 */
vec3 surface(vec2 p) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < MAX_DROPS; i++) {
    if (i >= uDropCount) break;
    vec4  d = uDrops[i];
    float t = uTime - d.z;
    if (t <= 0.0) continue;
    vec2  dp = p - d.xy;
    float r  = max(length(dp), 1e-4);
    vec2  hd = dropField(r, t, d.w, uK * uDropK[i]);
    acc.x  += hd.x;
    acc.yz += hd.y * (dp / r);          // chain rule: radial -> x,z
  }
  return acc * uHeightScale;
}

vec3 surfaceNormal(vec3 s) {
  return normalize(vec3(-s.y, 1.0, -s.z));
}
`;

/**
 * Displacement only. The normal used for shading is deliberately not
 * computed here; every fragment shader recomputes `surface()` per pixel.
 *
 * `surface()` is evaluated in the plane's *local* xz, not world xz, so a
 * surface is free to rotate its mesh (the blade background banks it 45
 * degrees) without the wave field rotating with it or drops landing
 * somewhere other than where they were spawned.
 */
/**
 * What a fragment shader needs before it can take a normal from
 * `surfaceNormal` into the world space the camera and the light live in.
 *
 * three's *vertex* prefix declares `modelMatrix`; its *fragment* prefix
 * does not - it provides only `viewMatrix`, `cameraPosition` and
 * `isOrthographic`. A fragment shader that wants the model matrix has to
 * declare it itself, and three then populates it from the object's world
 * matrix; this is the same trick three's own
 * `transmission_pars_fragment` uses. It cannot live in
 * `WATER_FIELD_CHUNK`, because that chunk is injected into the vertex
 * stage too, where the declaration would collide with the prefix's.
 */
export const WATER_FRAGMENT_PRELUDE = /* glsl */ `
uniform mat4 modelMatrix;

vec3 worldNormal(vec3 s) {
  return normalize(mat3(modelMatrix) * surfaceNormal(s));
}
`;

export const WATER_VERTEX_SHADER = /* glsl */ `
${WATER_FIELD_CHUNK}

varying vec3 vWorldPos;
varying vec2 vField;
varying float vHeight;

void main() {
  vec3 s = surface(position.xz);
  vec3 local = position + vec3(0.0, s.x + uLift, 0.0);
  vec4 wp = modelMatrix * vec4(local, 1.0);
  vWorldPos = wp.xyz;
  vField    = position.xz;
  vHeight   = s.x;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
