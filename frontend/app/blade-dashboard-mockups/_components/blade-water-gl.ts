/**
 * The blade surface: DESIGN.md §2.1 (section gradient), §3 / §3.1 (the
 * water relief that replaced the concentric sheen and the CSS ripples)
 * and §7.4 (the color crossfade), drawn into one canvas on one WebGL2
 * context.
 *
 * Two passes, back to front:
 *
 * 1. A screen-space quad painting the section's radial gradient. This is
 *    the blade's identity and it is still a gradient, not a rendering of
 *    water. Because the stops arrive as numbers (`blade-gradient.ts`) a
 *    blade switch is a real per-stop interpolation rather than CSS's
 *    fade-a-copy-on-top, and the whole thing is dithered, which kills the
 *    banding the CSS version shows across a wide panel.
 * 2. The water sheet, banked 45 degrees, contributing *only relief*: sky
 *    on the crests, deep tint in the troughs, and nothing whatsoever
 *    where the surface is still. So still water is invisible and the
 *    gradient underneath reads exactly as it always did.
 *
 * The wave field itself is shared with `/demo`
 * (`@/app/_water/water-field`); only the shading pass below is the
 * dashboard's.
 *
 * Everything works in **sRGB**, with no tone mapping and no
 * `<colorspace_fragment>`: this surface has to match the CSS gradient it
 * falls back to pixel for pixel, and CSS composites in sRGB.
 *
 * Keep the GLSL ASCII-only; see the note in `water-field.ts`.
 */

import * as THREE from "three";
import {
  WATER_FIELD_CHUNK,
  WATER_FRAGMENT_PRELUDE,
  WATER_VERTEX_SHADER,
  MAX_DROPS,
} from "@/app/_water/water-field";
import { CANVAS_HEIGHT, edgeDeltaTable } from "./blade-curve";
import { BLADE_MOTION_MS, bladeEase } from "./blade-motion";
import { hexToRgb, STOP_COUNT, type SectionGradient } from "./blade-gradient";
import {
  BLADE_WATER_PARAMS,
  DROP_INTERVAL,
  DROP_JITTER,
  DROP_SPREAD_X,
  DROP_SPREAD_Z,
  RELIEF_GAIN,
  RELIEF_OPACITY,
  WATER_CAMERA,
  WATER_LIGHT_DIR,
  WATER_PLANE_SEGMENTS,
  WATER_PLANE_SIZE,
  waterPalette,
} from "./blade-water";
import {
  bladeWaterState,
  subscribeBladeWater,
  type BladeWaterState,
} from "./blade-water-controls";

/** The reference frame the panel edges are expressed in (§1.2). */
const REFERENCE_WIDTH = 1280;
/** Resolution of the sampled edge profile. Well under a pixel of error. */
const CURVE_SAMPLES = 512;
/** Retina is worth it; beyond 2x is pure fill cost. */
const MAX_DPR = 2;

const FULLSCREEN_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const GRADIENT_FRAGMENT = /* glsl */ `
precision highp float;

#define STOPS ${STOP_COUNT}

uniform vec2  uResolution;
uniform vec2  uFocal;        // fraction of the box, always 50% / 44%
uniform vec2  uRadius;       // fraction of the box, always 90% / 80%
uniform float uStopAt[STOPS];
uniform vec3  uColor[STOPS]; // already crossfaded on the CPU

/** Piecewise-linear in sRGB, exactly as CSS reads a radial-gradient. */
vec3 sectionColor(float t) {
  if (t <= uStopAt[0]) return uColor[0];
  for (int i = 0; i < STOPS - 1; i++) {
    if (t <= uStopAt[i + 1]) {
      float span = max(uStopAt[i + 1] - uStopAt[i], 1e-6);
      return mix(uColor[i], uColor[i + 1], (t - uStopAt[i]) / span);
    }
  }
  return uColor[STOPS - 1];
}

/** Enough noise to break up the banding a wide flat gradient shows. */
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uResolution;
  vec3 col = sectionColor(length((p - uFocal) / uRadius));
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const WATER_RELIEF_FRAGMENT = /* glsl */ `
${WATER_FIELD_CHUNK}
${WATER_FRAGMENT_PRELUDE}

uniform vec2  uResolution;
uniform vec2  uPanel;        // left / right edge, reference px, eased
uniform float uMasked;       // 1 = clip to the panel curve
uniform sampler2D uCurve;    // edge x-delta profile, DESIGN.md 1.1
uniform int   uCurveSize;

uniform vec3  uDeep, uHorizon, uZenith, uLightDir;
uniform float uRelief;       // wave height -> opacity
uniform float uOpacity;      // cap on the whole layer

varying vec3 vWorldPos;
varying vec2 vField;
varying float vHeight;

/** The lazy S sampled at y (reference px), lerped between two texels. */
float edgeDelta(float y) {
  float f = clamp(y / ${CANVAS_HEIGHT.toFixed(1)}, 0.0, 1.0) * float(uCurveSize - 1);
  int i0 = int(floor(f));
  int i1 = min(i0 + 1, uCurveSize - 1);
  float a = texelFetch(uCurve, ivec2(i0, 0), 0).r;
  float b = texelFetch(uCurve, ivec2(i1, 0), 0).r;
  return mix(a, b, f - float(i0));
}

void main() {
  // DESIGN.md 1.1 panel mask, resolved before anything expensive: the
  // waves belong to the open blade and must not spill onto the collapsed
  // tab gutters. One device pixel, in reference px, is the edge's
  // antialiasing width.
  vec2 uv = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uResolution;
  float refX = uv.x * ${REFERENCE_WIDTH.toFixed(1)};
  float d    = edgeDelta(uv.y * ${CANVAS_HEIGHT.toFixed(1)});
  float aa   = ${REFERENCE_WIDTH.toFixed(1)} / uResolution.x;
  float left  = uPanel.x - d;
  float right = uPanel.y + d;
  float inside = smoothstep(left - aa, left + aa, refX)
               * (1.0 - smoothstep(right - aa, right + aa, refX));
  float mask = mix(1.0, inside, uMasked);
  if (mask <= 0.0) discard;

  // The field is sampled in the sheet's own xz, so banking the mesh does
  // not squash the rings into ellipses; the normal is then rotated into
  // world space, where the camera and the light live.
  vec3 s = surface(vField);
  vec3 N = worldNormal(s);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.5));
  vec3 H   = normalize(normalize(uLightDir) + V);
  float spec = pow(max(dot(N, H), 0.0), 256.0);

  // Signed relief. A crest takes the reflected sky, a trough the deep
  // tint, and still water takes nothing at all - which is what lets the
  // section gradient underneath show through untouched.
  float lift = clamp(s.x * uRelief, -1.0, 1.0);
  vec3  tint = lift >= 0.0 ? sky : uDeep;
  float alpha = clamp(abs(lift) * uOpacity + spec, 0.0, 1.0);

  gl_FragColor = vec4(tint + spec, alpha * mask);
}
`;

/** The panel's edges in reference px (§1.2); null for a full-bleed surface. */
export interface PanelEdges {
  leftX: number;
  rightX: number;
}

/** What the surface should be showing. Changes tween at the blade tempo. */
export interface SurfaceState {
  gradient: SectionGradient;
  panel: PanelEdges | null;
}

/** Resolved, mid-tween values - what actually reaches the uniforms. */
interface Frame {
  /** STOP_COUNT x RGB, flattened for `uniform3fv`. */
  stops: Float32Array;
  /** deep, horizon, zenith - 3 x RGB. */
  palette: Float32Array;
  panel: [number, number];
}

function frameOf(state: SurfaceState): Frame {
  const stops = new Float32Array(STOP_COUNT * 3);
  state.gradient.stops.forEach((stop, i) => stops.set(hexToRgb(stop.color), i * 3));
  const { deep, horizon, zenith } = waterPalette(state.gradient);
  const palette = new Float32Array([...deep, ...horizon, ...zenith]);
  return {
    stops,
    palette,
    panel: state.panel ? [state.panel.leftX, state.panel.rightX] : [0, REFERENCE_WIDTH],
  };
}

function lerpArray(from: Float32Array, to: Float32Array, t: number): Float32Array {
  const out = new Float32Array(from.length);
  for (let i = 0; i < out.length; i++) out[i] = from[i] + (to[i] - from[i]) * t;
  return out;
}

function lerpFrame(from: Frame, to: Frame, t: number): Frame {
  return {
    stops: lerpArray(from.stops, to.stops, t),
    palette: lerpArray(from.palette, to.palette, t),
    panel: [
      from.panel[0] + (to.panel[0] - from.panel[0]) * t,
      from.panel[1] + (to.panel[1] - from.panel[1]) * t,
    ],
  };
}

/**
 * Owns one three.js renderer and draws the blade surface into it.
 *
 * Construction throws when WebGL2 is unavailable; the caller is expected
 * to catch that and leave the CSS fallback showing rather than degrade to
 * a blank canvas.
 */
export class BladeWaterRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly gradientScene = new THREE.Scene();
  private readonly gradientCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly gradientGeometry: THREE.PlaneGeometry;
  private readonly gradientMaterial: THREE.ShaderMaterial;
  private readonly waterScene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly waterGeometry: THREE.PlaneGeometry;
  private readonly waterMaterial: THREE.ShaderMaterial;
  private readonly curve: THREE.DataTexture;
  /** Kept so the tuning overlay can re-bank the sheet live. */
  private readonly sheet: THREE.Mesh;
  private readonly unsubscribe: () => void;

  /** Origins, start times and strengths; mutated in place, never replaced. */
  private readonly drops = Array.from(
    { length: MAX_DROPS },
    () => new THREE.Vector4(0, 0, -1e6, 0),
  );
  private dropHead = 0;
  private dropCount = 0;
  private nextDrop = 0.2;
  private dropInterval = DROP_INTERVAL;

  private from: Frame;
  private to: Frame;
  private tweenStart = -Infinity;
  private masked: number;
  private animate = 1;
  private origin = -1;
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement, initial: SurfaceState) {
    // Throws when a context cannot be created, which is the signal
    // `BladeSurface` is waiting for to leave the CSS fallback up.
    // `capabilities.isWebGL2` is not that signal: three hardcodes it to
    // true now that WebGL1 support is gone.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    // Two passes into one buffer, so the second must not wipe the first.
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);

    const { focal, radius, stops } = initial.gradient;
    // One Vector2 deliberately shared by both materials, so `resize` has
    // a single place to write the drawing-buffer size.
    const resolution = new THREE.Vector2(1, 1);

    this.gradientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: resolution },
        uFocal: { value: new THREE.Vector2(focal[0], focal[1]) },
        uRadius: { value: new THREE.Vector2(radius[0], radius[1]) },
        uStopAt: { value: stops.map((s) => s.at) },
        uColor: { value: new Float32Array(STOP_COUNT * 3) },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: GRADIENT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.gradientGeometry = new THREE.PlaneGeometry(2, 2);
    this.gradientScene.add(
      new THREE.Mesh(this.gradientGeometry, this.gradientMaterial),
    );

    const table = edgeDeltaTable(CURVE_SAMPLES);
    this.curve = new THREE.DataTexture(
      table,
      CURVE_SAMPLES,
      1,
      THREE.RedFormat,
      THREE.FloatType,
    );
    this.curve.minFilter = THREE.NearestFilter;
    this.curve.magFilter = THREE.NearestFilter;
    this.curve.needsUpdate = true;

    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDropCount: { value: 0 },
        uDrops: { value: this.drops },
        uResolution: { value: resolution },
        uPanel: { value: new THREE.Vector2(0, REFERENCE_WIDTH) },
        uMasked: { value: initial.panel ? 1 : 0 },
        uCurve: { value: this.curve },
        uCurveSize: { value: CURVE_SAMPLES },
        uDeep: { value: new THREE.Vector3() },
        uHorizon: { value: new THREE.Vector3() },
        uZenith: { value: new THREE.Vector3() },
        uLightDir: { value: new THREE.Vector3(...WATER_LIGHT_DIR) },
        uRelief: { value: RELIEF_GAIN },
        uOpacity: { value: RELIEF_OPACITY },
        uLift: { value: 0 },
        uAlpha: { value: 1 },
        ...Object.fromEntries(
          Object.entries(BLADE_WATER_PARAMS).map(([k, v]) => [k, { value: v }]),
        ),
      },
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_RELIEF_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.waterGeometry = new THREE.PlaneGeometry(
      WATER_PLANE_SIZE,
      WATER_PLANE_SIZE,
      WATER_PLANE_SEGMENTS,
      WATER_PLANE_SEGMENTS,
    );
    this.waterGeometry.rotateX(-Math.PI / 2);
    this.sheet = new THREE.Mesh(this.waterGeometry, this.waterMaterial);
    // The swell pushes vertices off the plane the bounding sphere was
    // computed from, and the sheet is deliberately larger than the view.
    this.sheet.frustumCulled = false;
    this.waterScene.add(this.sheet);

    this.camera = new THREE.PerspectiveCamera(WATER_CAMERA.fov, 1, 0.1, 2000);
    this.camera.position.set(...WATER_CAMERA.position);
    this.camera.lookAt(0, 0, 0);

    this.from = frameOf(initial);
    this.to = this.from;
    this.masked = initial.panel ? 1 : 0;

    // Adopt whatever the overlay is currently showing, so a surface that
    // mounts later (a full-screen screen opening over the blade) matches
    // the one underneath instead of snapping back to the defaults.
    this.applyControls(bladeWaterState());
    this.unsubscribe = subscribeBladeWater((next) => this.applyControls(next));
  }

  /**
   * Live tuning (`blade-water-controls.ts`). Every wave parameter is a
   * uniform, so most of this is a straight copy; the bank is a mesh
   * transform and the cadence is plain bookkeeping.
   */
  private applyControls(next: Readonly<BladeWaterState>) {
    const uniforms = this.waterMaterial.uniforms;
    for (const [key, value] of Object.entries(next)) {
      if (uniforms[key]) uniforms[key].value = value;
    }
    this.sheet.rotation.z = THREE.MathUtils.degToRad(next.tiltZDeg);
    this.dropInterval = next.dropInterval;
  }

  /**
   * Point the surface at a new state. The move is eased over the blade
   * tempo (§7.4) from wherever the tween currently is, so switching
   * blades mid-transition picks up the color and edges on screen rather
   * than snapping back to the last target.
   */
  setState(next: SurfaceState, now: number) {
    const target = frameOf(next);
    this.masked = next.panel ? 1 : 0;
    if (this.tweenStart === -Infinity) {
      this.from = target;
      this.to = target;
      return;
    }
    this.from = this.frameAt(now);
    this.to = target;
    this.tweenStart = now;
  }

  /**
   * §7.4: reduced-motion users get the cut. The water also stops: with
   * time frozen the sheet is perfectly still, which in this shading means
   * perfectly transparent, so the blade is simply its gradient.
   */
  setAnimated(animate: boolean) {
    this.animate = animate ? 1 : 0;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    if (cssWidth === this.width && cssHeight === this.height) return;
    this.width = cssWidth;
    this.height = cssHeight;
    this.renderer.setPixelRatio(Math.min(dpr, MAX_DPR));
    // updateStyle off: the canvas gets its CSS size from its classes.
    this.renderer.setSize(cssWidth, cssHeight, false);
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    (this.gradientMaterial.uniforms.uResolution.value as THREE.Vector2).copy(buffer);
    this.camera.aspect = cssWidth / cssHeight;
    this.camera.updateProjectionMatrix();
  }

  /** Whether the tween has finished. The water never settles. */
  settled(now: number) {
    return !this.animate || now - this.tweenStart >= BLADE_MOTION_MS;
  }

  private frameAt(now: number): Frame {
    if (!this.animate) return this.to;
    const elapsed = now - this.tweenStart;
    if (!(elapsed < BLADE_MOTION_MS)) return this.to;
    return lerpFrame(this.from, this.to, bladeEase(elapsed / BLADE_MOTION_MS));
  }

  private addDrop(t: number) {
    this.drops[this.dropHead].set(
      (Math.random() * 2 - 1) * DROP_SPREAD_X,
      (Math.random() * 2 - 1) * DROP_SPREAD_Z,
      t,
      1,
    );
    this.dropHead = (this.dropHead + 1) % MAX_DROPS;
    this.dropCount = Math.min(this.dropCount + 1, MAX_DROPS);
    this.waterMaterial.uniforms.uDropCount.value = this.dropCount;
  }

  draw(now: number) {
    if (!this.width) return;
    if (this.origin < 0) this.origin = now;
    // The very first draw has no previous state to come from.
    if (this.tweenStart === -Infinity) this.tweenStart = now - BLADE_MOTION_MS;

    const frame = this.frameAt(now);
    const gradient = this.gradientMaterial.uniforms;
    const water = this.waterMaterial.uniforms;

    gradient.uColor.value = frame.stops;
    (water.uPanel.value as THREE.Vector2).set(frame.panel[0], frame.panel[1]);
    water.uMasked.value = this.masked;
    (water.uDeep.value as THREE.Vector3).fromArray(frame.palette, 0);
    (water.uHorizon.value as THREE.Vector3).fromArray(frame.palette, 3);
    (water.uZenith.value as THREE.Vector3).fromArray(frame.palette, 6);

    // Kept relative to the first frame so float precision stays good.
    const t = this.animate ? (now - this.origin) / 1000 : 0;
    water.uTime.value = t;
    if (this.animate && t >= this.nextDrop) {
      this.addDrop(t);
      this.nextDrop = t + this.dropInterval + Math.random() * DROP_JITTER;
    }

    this.renderer.clear();
    this.renderer.render(this.gradientScene, this.gradientCamera);
    this.renderer.render(this.waterScene, this.camera);
  }

  dispose() {
    this.unsubscribe();
    this.gradientGeometry.dispose();
    this.gradientMaterial.dispose();
    this.waterGeometry.dispose();
    this.waterMaterial.dispose();
    this.curve.dispose();
    // Deliberately no `forceContextLoss()`: the canvas is React's and
    // outlives this renderer. Strict Mode mounts effects twice, so losing
    // the context here would leave the second mount calling
    // `getShaderPrecisionFormat` on a dead context, which returns null.
    this.renderer.dispose();
  }
}
