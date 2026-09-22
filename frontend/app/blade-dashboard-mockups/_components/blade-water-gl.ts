/**
 * The blade surface: the section gradient of DESIGN.md §2.1, the water
 * relief of §3 and §3.1, which replaced the concentric sheen and the CSS
 * ripples, and the colour crossfade of §7.4. All of it goes into one
 * canvas on one WebGL2 context.
 *
 * There are two passes, back to front:
 *
 * 1. A screen-space quad that paints the radial gradient of the section.
 *    This is the identity of the blade, and it is still a gradient and
 *    not an image of water. The stops arrive as numbers
 *    (`blade-gradient.ts`), thus a blade switch interpolates each stop
 *    and does not fade a copy on top as CSS does. The pass also dithers
 *    the gradient, which removes the banding that the CSS version shows
 *    across a wide panel.
 * 2. The water sheet, banked 45 degrees, which adds only relief: sky on
 *    the crests, a deep tint in the troughs and nothing where the
 *    surface is still. Thus still water is invisible and the gradient
 *    below it does not change.
 *
 * `/demo` shares the wave field (`@/app/_water/water-field`). Only the
 * shading pass below belongs to the dashboard.
 *
 * All the work is in sRGB, with no tone mapping and no
 * `<colorspace_fragment>`. This surface must match the CSS gradient that
 * it falls back to pixel for pixel, and CSS composites in sRGB.
 *
 * Use only ASCII characters in the GLSL. Refer to `water-field.ts`.
 */

import * as THREE from "three";
import {
  WATER_FIELD_CHUNK,
  WATER_FRAGMENT_PRELUDE,
  WATER_VERTEX_SHADER,
  MAX_DROPS,
  DEFAULT_DROP_CAPACITY,
  flatDropK,
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
import {
  bladePulse,
  PULSE_BLOOM,
  PULSE_HUE_DEG,
  PULSE_LIFT,
} from "./blade-pulse";

/** The reference frame of the panel edges (§1.2). */
const REFERENCE_WIDTH = 1280;
/** Resolution of the sampled edge profile. The error is less than a pixel. */
const CURVE_SAMPLES = 512;
/** Retina is necessary. More than 2x is only fill cost. */
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
uniform float uPulse;        // bass envelope, 0..1 (blade-pulse.ts)

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

/** Sufficient noise to remove the banding of a wide flat gradient. */
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

/**
 * A rotation about the grey axis. It changes the hue and keeps the luma,
 * thus the pulse moves the colour and does not also move the brightness.
 * The lift below moves the brightness.
 */
vec3 hueRotate(vec3 c, float angle) {
  const vec3 axis = vec3(0.57735027); // normalised (1, 1, 1)
  return c * cos(angle)
       + cross(axis, c) * sin(angle)
       + axis * dot(axis, c) * (1.0 - cos(angle));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uResolution;

  // DESIGN.md 6.16: the bass moves the gradient. A smaller radius moves
  // the stops outward, thus a kick makes the bright core larger and does
  // not brighten the full panel at one time. The swell starts at the
  // focal point and travels, as the water does.
  float r = length((p - uFocal) / uRadius);
  vec3 col = sectionColor(r / (1.0 + uPulse * ${PULSE_BLOOM.toFixed(3)}));
  col = hueRotate(col, uPulse * ${((PULSE_HUE_DEG * Math.PI) / 180).toFixed(5)});
  col *= 1.0 + uPulse * ${PULSE_LIFT.toFixed(3)};

  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * The panel mask of DESIGN.md 1.1: which pixels belong to the open blade
 * and not to the full canvas. It is separate from the shading that uses
 * it, because it is the geometry of the panel in GLSL. The gradient pass
 * is never masked, and each pass that is masked must stop exactly at
 * this curve.
 *
 * Each edge in 1.1 is one curve at a different top-x, thus one sampled
 * profile d(y) is sufficient: the panel runs from leftX - d(y) to
 * rightX + d(y). These are two scalars, thus the mask glides with the
 * CSS clip-path during a blade switch and needs no 66 vertices.
 */
const PANEL_MASK_CHUNK = /* glsl */ `
uniform vec2  uResolution;
uniform vec2  uPanel;        // left / right edge, reference px, eased
uniform float uMasked;       // 1 = clip to the panel curve
uniform sampler2D uCurve;    // edge x-delta profile, DESIGN.md 1.1
uniform int   uCurveSize;

/** The lazy S at y, in reference px, interpolated between two texels. */
float edgeDelta(float y) {
  float f = clamp(y / ${CANVAS_HEIGHT.toFixed(1)}, 0.0, 1.0) * float(uCurveSize - 1);
  int i0 = int(floor(f));
  int i1 = min(i0 + 1, uCurveSize - 1);
  float a = texelFetch(uCurve, ivec2(i0, 0), 0).r;
  float b = texelFetch(uCurve, ivec2(i1, 0), 0).r;
  return mix(a, b, f - float(i0));
}

/**
 * 0 outside the panel and 1 inside it, with a ramp of one pixel at the
 * edge. The antialiasing width is one device pixel, in reference px.
 */
float panelMask(vec2 uv) {
  float refX = uv.x * ${REFERENCE_WIDTH.toFixed(1)};
  float d    = edgeDelta(uv.y * ${CANVAS_HEIGHT.toFixed(1)});
  float aa   = ${REFERENCE_WIDTH.toFixed(1)} / uResolution.x;
  float left  = uPanel.x - d;
  float right = uPanel.y + d;
  float inside = smoothstep(left - aa, left + aa, refX)
               * (1.0 - smoothstep(right - aa, right + aa, refX));
  return mix(1.0, inside, uMasked);
}
`;

const WATER_RELIEF_FRAGMENT = /* glsl */ `
${WATER_FIELD_CHUNK}
${WATER_FRAGMENT_PRELUDE}
${PANEL_MASK_CHUNK}

uniform vec3  uDeep, uHorizon, uZenith, uLightDir;
uniform float uRelief;       // wave height -> opacity
uniform float uOpacity;      // cap on the whole layer

varying vec3 vWorldPos;
varying vec2 vField;
varying float vHeight;

void main() {
  // Computed before the expensive work. The waves belong to the open
  // blade and must not go onto the collapsed tab gutters.
  vec2 uv = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uResolution;
  float mask = panelMask(uv);
  if (mask <= 0.0) discard;

  // The code samples the field in the local xz of the sheet, thus a bank
  // of the mesh does not make the rings elliptical. The normal then moves
  // into world space, where the camera and the light are.
  vec3 s = surface(vField);
  vec3 N = worldNormal(s);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.5));
  vec3 H   = normalize(normalize(uLightDir) + V);
  float spec = pow(max(dot(N, H), 0.0), 256.0);

  // Signed relief. A crest takes the reflected sky, a trough takes the
  // deep tint, and still water takes nothing. Thus the section gradient
  // below stays unchanged.
  float lift = clamp(s.x * uRelief, -1.0, 1.0);
  vec3  tint = lift >= 0.0 ? sky : uDeep;
  float alpha = clamp(abs(lift) * uOpacity + spec, 0.0, 1.0);

  gl_FragColor = vec4(tint + spec, alpha * mask);
}
`;

/** The edges of the panel in reference px (§1.2). A full-bleed surface passes null. */
export interface PanelEdges {
  leftX: number;
  rightX: number;
}

/** What the surface must show. A change tweens at the blade tempo. */
export interface SurfaceState {
  gradient: SectionGradient;
  panel: PanelEdges | null;
}

/** The resolved mid-tween values. These reach the uniforms. */
interface Frame {
  /** STOP_COUNT x RGB, flat, for `uniform3fv`. */
  stops: Float32Array;
  /** The deep, horizon and zenith colours: 3 x RGB. */
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
 * The constructor throws when WebGL2 is not available. The caller must
 * catch the error and keep the CSS fallback on the screen. A blank
 * canvas is not acceptable.
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
  /** Kept, thus the tuning overlay can bank the sheet at run time. */
  private readonly sheet: THREE.Mesh;
  private readonly unsubscribe: () => void;

  /** The origins, start times and strengths. Mutated in place, never replaced. */
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
    // This throws when it cannot create a context. `BladeSurface` waits
    // for that error and then keeps the CSS fallback. Do not use
    // `capabilities.isWebGL2`: three sets it to true always, because it
    // no longer supports WebGL1.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    // Two passes write one buffer, thus the second must not clear the first.
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);

    const { focal, radius, stops } = initial.gradient;
    // Both materials share one Vector2, thus `resize` writes the size of
    // the drawing buffer in one place.
    const resolution = new THREE.Vector2(1, 1);

    this.gradientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: resolution },
        uFocal: { value: new THREE.Vector2(focal[0], focal[1]) },
        uRadius: { value: new THREE.Vector2(radius[0], radius[1]) },
        uStopAt: { value: stops.map((s) => s.at) },
        uColor: { value: new Float32Array(STOP_COUNT * 3) },
        uPulse: { value: 0 },
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
        // Each drop uses uK. Only the audio visualizer changes it.
        uDropK: { value: flatDropK() },
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
    // The swell moves vertices off the plane that gave the bounding
    // sphere, and the sheet is larger than the view.
    this.sheet.frustumCulled = false;
    this.waterScene.add(this.sheet);

    this.camera = new THREE.PerspectiveCamera(WATER_CAMERA.fov, 1, 0.1, 2000);
    this.camera.position.set(...WATER_CAMERA.position);
    this.camera.lookAt(0, 0, 0);

    this.from = frameOf(initial);
    this.to = this.from;
    this.masked = initial.panel ? 1 : 0;

    // Use the current values of the overlay. Thus a surface that mounts
    // later, such as a full-screen screen above the blade, matches the
    // surface below it and does not return to the defaults.
    this.applyControls(bladeWaterState());
    this.unsubscribe = subscribeBladeWater((next) => this.applyControls(next));
  }

  /**
   * Live tuning (`blade-water-controls.ts`). Each wave parameter is a
   * uniform, thus most of this method is a copy. The bank is a mesh
   * transform and the drop rate is bookkeeping.
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
   * Sends the surface to a new state. The move eases over the blade
   * tempo (§7.4) from the current position of the tween. Thus a blade
   * switch during a transition continues from the colour and the edges
   * on the screen and does not return to the last target.
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
   * §7.4: a user with reduced motion gets a cut. The water also stops.
   * With the time frozen the sheet is fully still, and in this shading a
   * still sheet is fully transparent. Thus the blade is its gradient.
   */
  setAnimated(animate: boolean) {
    this.animate = animate ? 1 : 0;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    if (cssWidth === this.width && cssHeight === this.height) return;
    this.width = cssWidth;
    this.height = cssHeight;
    this.renderer.setPixelRatio(Math.min(dpr, MAX_DPR));
    // updateStyle is off: the canvas takes its CSS size from its classes.
    this.renderer.setSize(cssWidth, cssHeight, false);
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    (this.gradientMaterial.uniforms.uResolution.value as THREE.Vector2).copy(buffer);
    this.camera.aspect = cssWidth / cssHeight;
    this.camera.updateProjectionMatrix();
  }

  /** Whether the tween is complete. The water is never still. */
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
    // Use the capacity and not the array size. This surface drops one
    // time in some seconds and does not need the larger budget of the
    // visualizer.
    this.dropHead = (this.dropHead + 1) % DEFAULT_DROP_CAPACITY;
    this.dropCount = Math.min(this.dropCount + 1, DEFAULT_DROP_CAPACITY);
    this.waterMaterial.uniforms.uDropCount.value = this.dropCount;
  }

  draw(now: number) {
    if (!this.width) return;
    if (this.origin < 0) this.origin = now;
    // The first draw has no previous state.
    if (this.tweenStart === -Infinity) this.tweenStart = now - BLADE_MOTION_MS;

    const frame = this.frameAt(now);
    const gradient = this.gradientMaterial.uniforms;
    const water = this.waterMaterial.uniforms;

    gradient.uColor.value = frame.stops;
    // The bass pulse (`blade-pulse.ts`). It is zero while nothing plays
    // and zero under reduced motion: a background that moves with the
    // music is what that preference removes (§7.4).
    gradient.uPulse.value = this.animate ? bladePulse(now) : 0;
    (water.uPanel.value as THREE.Vector2).set(frame.panel[0], frame.panel[1]);
    water.uMasked.value = this.masked;
    (water.uDeep.value as THREE.Vector3).fromArray(frame.palette, 0);
    (water.uHorizon.value as THREE.Vector3).fromArray(frame.palette, 3);
    (water.uZenith.value as THREE.Vector3).fromArray(frame.palette, 6);

    // Relative to the first frame, thus the float precision stays good.
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
    // Do not call `forceContextLoss()`. The canvas belongs to React and
    // stays after this renderer. Strict Mode mounts an effect two times,
    // thus a lost context here would make the second mount call
    // `getShaderPrecisionFormat` on a dead context, which returns null.
    this.renderer.dispose();
  }
}
