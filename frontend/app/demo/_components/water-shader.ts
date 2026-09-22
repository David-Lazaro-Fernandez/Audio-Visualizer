/**
 * How the `/demo` page shades the shared wave field: a glossy water
 * surface, plus a height and contour view that makes the geometry easy
 * to read (spec sections 4-5).
 *
 * The field, which is the wave packet, the jet, the analytic derivative
 * and the displacement pass, is in `@/app/_water/water-field`. The blade
 * dashboard background drives the same field with a fully different
 * shading pass. Only the fragment shader below is specific to this page.
 *
 * Use only ASCII characters. Refer to the note in `water-field.ts`.
 */

import {
  WATER_FIELD_CHUNK,
  WATER_FRAGMENT_PRELUDE,
  WATER_VERTEX_SHADER,
} from "@/app/_water/water-field";

export { WATER_VERTEX_SHADER };

/**
 * Analytic normals for each pixel. Mode 0 is the glossy view: a sky
 * reflection weighted by the Schlick Fresnel term with the F0 of water,
 * 0.02, plus a tight specular. Mode 1 is the height view: a diverging
 * ramp with contour lines. The width of a line comes from fwidth, thus a
 * line stays one pixel wide at each slope of the surface.
 *
 * The code samples the field at `vField`, which is the local xz of the
 * plane. The model matrix then moves the normal into world space,
 * because the reflection and the light direction are both in world space
 * and a surface can rotate its mesh.
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
