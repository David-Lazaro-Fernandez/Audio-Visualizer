/**
 * The `/demo` page's shading of the shared wave field: a glossy water
 * surface, plus a height/contour view that makes the geometry easy to
 * read (spec sections 4-5).
 *
 * The field itself - the wave packet, the jet, the analytic derivative
 * and the displacement pass - lives in `@/app/_water/water-field`,
 * because the blade dashboard background drives the same field with a
 * completely different shading pass. Only the fragment shader below is
 * specific to this page.
 *
 * Keep this file ASCII-only; see the note in `water-field.ts`.
 */

import {
  WATER_FIELD_CHUNK,
  WATER_FRAGMENT_PRELUDE,
  WATER_VERTEX_SHADER,
} from "@/app/_water/water-field";

export { WATER_VERTEX_SHADER };

/**
 * Per-pixel analytic normals. Mode 0 is the glossy read: a sky reflection
 * weighted by Schlick Fresnel with water's F0 of 0.02, plus a tight
 * specular. Mode 1 is the height read: a diverging ramp with contour
 * lines whose width comes from fwidth, so they stay one pixel wide
 * however steep the surface is.
 *
 * The field is sampled at `vField`, the plane's own xz, and the resulting
 * normal is rotated into world space by the model matrix - the reflection
 * and the light direction are both world-space, and a surface is allowed
 * to rotate its mesh.
 */
export const WATER_FRAGMENT_SHADER = /* glsl */ `
${WATER_FIELD_CHUNK}
${WATER_FRAGMENT_PRELUDE}

uniform int   uMode;
uniform vec3  uDeep, uHorizon, uZenith, uLightDir;
uniform float uContourFreq;

varying vec3 vWorldPos;
varying vec2 vField;
varying float vHeight;

void main() {
  vec3 s = surface(vField);
  vec3 N = worldNormal(s);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 col;

  if (uMode == 0) {
    vec3  R    = reflect(-V, N);
    vec3  sky  = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.5));
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3  H    = normalize(normalize(uLightDir) + V);
    float spec = pow(max(dot(N, H), 0.0), 256.0);
    col = mix(uDeep, sky, fres) + spec;
  } else {
    float h    = vHeight;
    vec3  base = mix(vec3(0.15, 0.25, 0.6), vec3(0.95, 0.6, 0.3), clamp(h * 4.0 + 0.5, 0.0, 1.0));
    float f    = fract(h * uContourFreq);
    float line = 1.0 - smoothstep(0.0, fwidth(h * uContourFreq) * 1.5, min(f, 1.0 - f));
    float lam  = 0.35 + 0.65 * max(dot(N, normalize(uLightDir)), 0.0);
    col = base * lam * (1.0 - 0.6 * line);
  }

  gl_FragColor = vec4(col, uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
