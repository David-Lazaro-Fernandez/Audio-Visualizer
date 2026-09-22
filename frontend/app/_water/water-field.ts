/**
 * The wave field: the GLSL that each water surface in this app shares,
 * with the drop bookkeeping on the CPU that feeds it.
 *
 * Two surfaces use it. The `/demo` page shades it as glossy water. The
 * blade dashboard background composites only its relief over the section
 * gradient. Their fragment shaders are fully different, but the height
 * field, its analytic radial derivative and the displacement pass are the
 * same, thus they are here one time.
 *
 * The model is a Gaussian-enveloped radial wave packet plus a separate
 * center jet. The model is linear, thus up to MAX_DROPS drops superpose.
 * The derivative travels with the height and is analytic, thus the
 * fragment shader can build an exact normal. Differenced neighbours come
 * out faceted at all usual mesh densities, because the rings read through
 * the reflection angle and not through the silhouette.
 *
 * **ASCII only.** WebGL rejects shader source that contains characters
 * outside the GLSL ES source character set, comments included. It rejects
 * the source in `shaderSource`, before the compiler runs, thus the error
 * has a null info log. The math below uses `sigma`, `tau`, `nu` and
 * `lambda` in place of the usual Greek letters.
 *
 * three.js compiles each material that is not a RawShaderMaterial as GLSL
 * ES 3.00 and aliases `varying` and `gl_FragColor`. Thus `glslVersion`
 * stays unset and `fwidth` is a core function.
 */

/**
 * Size of the drop array in the shader. This is the ceiling, not the
 * count that one surface uses.
 *
 * `surface()` leaves its loop at `uDropCount`, thus a surface pays for
 * the drops it holds and pays nothing for the empty tail. Thus a large
 * array is cheap, and the array must be large: the audio visualizer needs
 * dozens of ripples at the same time. A ripple lives two seconds, thus
 * `uDropCount` slots divided by two seconds is the highest drop rate that
 * does not recycle a wave that is still visible. With 16 slots, a busy
 * passage recycled a slot each 110 ms and cut each ripple almost at its
 * start.
 *
 * Surfaces that drop slowly, such as the blade background and `/demo`,
 * declare a smaller capacity and keep their initial cost.
 */
export const MAX_DROPS = 48;

/** What a surface uses unless it says otherwise. */
export const DEFAULT_DROP_CAPACITY = 16;

/**
 * A `uDropK` array that makes each drop use uK. Each surface needs it: an
 * unassigned uniform array reads as zero, and k = 0 makes the field fully
 * flat. Only the audio visualizer writes other values.
 */
export const flatDropK = () => new Float32Array(MAX_DROPS).fill(1);

/**
 * The wave math. Both stages of both surfaces use it.
 *
 * `uLift` and `uAlpha` are here and not in a fragment shader, because a
 * wireframe overlay uses these same sources and must stay above the
 * surface that it traces. At 0 and 1 the two uniforms do nothing.
 */
export const WATER_FIELD_CHUNK = /* glsl */ `
#define MAX_DROPS ${MAX_DROPS}
#define DISP_MODES 4

uniform float uTime;
uniform int   uDropCount;
uniform vec4  uDrops[MAX_DROPS];   // xy: origin (world x,z), z: start time, w: strength
/**
 * Wavenumber of each drop, as a multiplier of uK and not as an absolute
 * value. A vec4 has no space left for it. A multiplier also keeps the
 * array correct when uK changes: 1.0 means "the value of uK", which is
 * what each surface but the audio visualizer needs. The per-drop value
 * lets a bass onset make long, wide rings and a cymbal make tight rings.
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
 * env removes all the rings but those near the wavefront. Thus the water
 * stays flat in front of the wavefront, where nothing arrived, and flat
 * behind the packet, where the water settled. spread is the geometric
 * spreading on a 2D surface. decay is the global fade times the viscous
 * damping, which removes short waves more quickly than long waves.
 */
vec2 ripplePacket(float r, float t, float strength, float k) {
  float u      = r - uSpeed * t;     // distance behind the wavefront
  float sigma  = uSigma0 + uSigmaGrowth * t;
  float s2     = sigma * sigma;
  float env    = exp(-(u * u) / (2.0 * s2));
  float rr     = r + uR0;
  float spread = inversesqrt(rr);
  // Viscous damping increases with k^2, thus a short-wavelength drop dies
  // more quickly than a long one. This is physically correct, and it makes
  // the ripple of a cymbal brief and the ripple of a kick long.
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
 * capillary waves move in front, which puts the fine rings on the
 * outside. The dispersion relation gives each mode its own group
 * velocity, thus the one envelope divides into several that move apart
 * with time. The derivative uses the same product rule as above, but the
 * phase is now k*r - omega*t.
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
 * The jet is not a solution of the wave equation. It is a separate term.
 * B(t) is negative first, for the crater that the drop makes, then
 * positive, for the rebound column that releases a second droplet.
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

  // Hide the impact and keep only the wave that travels. Inside uQuiet a
  // drop adds nothing. This removes two things at the same time: the
  // crater and jet spike, which stays at r = 0 for all time, and the new
  // packet, whose full amplitude is inside r ~ sigma0 before it spreads.
  // The wavefront advances as r = c*t, thus a gate in r is also a fade-in
  // in time, and a drop swells into view instead of appearing.
  //
  // The derivative must obey the product rule. If it does not, the
  // normals, which shade the surface, disagree with the height. The
  // derivative of smoothstep is analytic, thus this stays exact. Zero
  // disables the gate, which is the default on each surface but the
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
 * (height, dh/dx, dh/dz) at a world xz, with the height scale applied.
 * Thus the gradient and the height always agree about the exaggeration.
 *
 * The loop bound is the compile-time MAX_DROPS with an early break, not
 * the uniform, because a uniform loop bound is not portable. Clamp r
 * before the division, or the impact point comes out as NaN.
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
 * What a fragment shader needs before it can move a normal from
 * `surfaceNormal` into the world space of the camera and the light.
 *
 * The vertex prefix of three declares `modelMatrix`. Its fragment prefix
 * does not: it gives only `viewMatrix`, `cameraPosition` and
 * `isOrthographic`. A fragment shader that needs the model matrix must
 * declare it, and three then fills it from the world matrix of the
 * object. The `transmission_pars_fragment` chunk of three uses the same
 * method. The declaration cannot go in `WATER_FIELD_CHUNK`, because that
 * chunk also goes into the vertex stage, where it would collide with the
 * declaration in the prefix.
 */
export const WATER_FRAGMENT_PRELUDE = /* glsl */ `
uniform mat4 modelMatrix;

vec3 worldNormal(vec3 s) {
  return normalize(mat3(modelMatrix) * surfaceNormal(s));
}
`;

/**
 * Displacement only. This stage does not compute the normal for shading.
 * Each fragment shader computes `surface()` again for each pixel.
 *
 * `surface()` reads the local xz of the plane, not the world xz. Thus a
 * surface can rotate its mesh, as the blade background does when it banks
 * the sheet 45 degrees, and the wave field does not rotate with it. The
 * drops stay at the positions where they started.
 */
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
