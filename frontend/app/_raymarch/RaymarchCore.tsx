"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { NOISE_CHUNK } from "@/app/_glsl/noise";
import { RAMP_CHUNK } from "@/app/_glsl/ramp";
import { useDrift } from "@/app/_ui/use-drift";
import {
  RAYMARCH_DRIFT_MS,
  RAYMARCH_KEYS,
  RAYMARCH_SPECS,
  raymarchDrifting,
  raymarchState,
  setRaymarchControl,
  subscribeRaymarch,
  subscribeRaymarchDrifting,
  type RaymarchState,
} from "./raymarch-controls";

/**
 * A raymarched core: the song as a lump of procedural rock.
 *
 * This is the first visualizer with no geometry. The others draw points,
 * lines or a mesh. This one draws one fullscreen quad and derives the
 * full image for each pixel with a march through a signed distance
 * function. The shape is not modelled, it is generated: a sphere plus
 * octaves of gradient noise. Thus it has detail at each scale and the
 * code stores none of it.
 *
 * The audio drives the shape at two spatial scales, which is the most
 * that a surface can show correctly. Bass swells the full body in broad
 * slow lumps. Treble makes it rough with a fine crust. You cannot read
 * 28 separate bands off a lump of rock. Spherical harmonics would be
 * mathematically correct and impossible to read. Thus the code folds the
 * spectrum into two energies plus a centroid, and the centroid selects
 * the hue from the ramp of the app.
 *
 * Read these two notes before you change the marcher:
 *
 * - It is not a true distance field. Noise on the radius of a sphere
 *   breaks the Lipschitz bound that a real SDF gives, thus a full step
 *   can go through the surface. Thus the code makes each step smaller
 *   (`STEP_SCALE`). This is the usual cost of a shape that is this
 *   simple to write.
 * - The cost is for each pixel, not for each object. Approximately 70
 *   steps of multi-octave noise at 1080p is near 25 G noise evaluations
 *   a second, which no integrated GPU can do. Thus the pixel ratio is a
 *   control: the canvas keeps its CSS size and marches fewer pixels,
 *   which is almost not visible on an image this soft.
 *
 * Use only ASCII characters in the GLSL. Refer to `app/_glsl/noise.ts`.
 */

/** Steps for each ray. It is a constant, thus the cost is predictable. */
const STEPS = 72;
/** Fraction of the reported distance that a step uses. Refer to the note above. */
const STEP_SCALE = 0.55;
/** Stop the march after this distance, in world units. */
const FAR = 24;

/** Width of a tunnel line, in device pixels, at each screen position. */
const LINE_PX = 1.4;
/**
 * The numerator of depth over r in the tunnel. It sets how much of the
 * corridor is on the screen and does nothing else. To scale it is the
 * same as to move the full tunnel along itself. Thus the ring spacing is
 * a knob and this value is a constant.
 */
const TUNNEL_DEPTH = 0.4;
/** Turns of the wall a second, in addition to the flight. */
const TUNNEL_SPIN = 0.08;
/**
 * Exponential fog, for each unit of distance ahead. It does two things.
 * It is the only cue that gives the corridor a scale. Also, the distance
 * increases without limit at the centre of the screen, thus the fog
 * makes the vanishing point black. Thus there is no vignette here and
 * none is necessary.
 */
const TUNNEL_FOG = 0.09;
/**
 * How far the camera banks into a bend, for each unit of the sideways
 * derivative of the path. This is the strongest cue that the tunnel
 * turns. Without it a curved corridor looks like walls that slide and
 * not like a camera that goes around a corner.
 */
const TUNNEL_BANK = 0.4;
/**
 * Fixed-point passes that resolve the screen position against the depth.
 *
 * The bend is circular: the radius gives the depth of a pixel, and the
 * depth gives the distance that the path moved that pixel.
 *
 * Six passes, from measurement and not from preference. At the bend that
 * this code uses, two passes leave half of the frame unresolved and four
 * leave 1.6%. Six leave 1.0%, and ten, twenty and forty leave 0.7, 0.6
 * and 0.55. More passes do not clear that last part, because near the
 * vanishing point the map is expansive and not slow. Thus six is the
 * point where the curve becomes flat, and the remainder is a core that
 * no number of iterations can correct.
 *
 * That core also sets the ceiling on Bend. The visible swing of the
 * corridor and the radius of the unresolved core are the same quantity.
 * Both are proportional to amplitude x frequency x the magnitude of
 * Bend, thus more bend always makes the core larger. The sign only
 * mirrors the curve, thus the two directions cost the same. Near a value
 * of 4 the core touches the edge of the frame. A larger amplitude with a
 * smaller frequency is not a solution: it keeps the swing at the same
 * value, because what shows is the change of the path across the visible
 * depth and not the size of the path.
 */
const PATH_PASSES = 6;

/**
 * The flashes: one ring of light sent down the tunnel at each bass onset.
 *
 * `LIFE` is the most important value. After this time a flash is gone,
 * and it does not fade out across a second. A longer life does not look
 * like a hit that lights the tunnel. It looks like decoration that
 * moves.
 *
 * `RUSH` is the distance that the ring travels along the depth axis in
 * that time. The flight of the tunnel would carry the ring, but at each
 * usable speed it moves one hundredth of the screen in a fifth of a
 * second. Thus the ring gets its own speed and looks like a shockwave
 * and not like a stripe that blinks.
 */
const FLASH_SLOTS = 6;
const FLASH_LIFE = 0.18;
const FLASH_RUSH = 1.8;
/** Width of a ring in device pixels, before its jitter. */
const FLASH_LINE_PX = 2.5;
/** Where a ring starts, as a radius on the screen: near the centre. */
const FLASH_START_MIN = 0.12;
const FLASH_START_MAX = 0.45;

/** How much the full low end adds to the flight speed, as a fraction. */
const SPEED_BOOST = 1.2;
/** How fast the steer follows the music: a fraction of the gap a frame. */
const STEER_RATE = 0.05;
/** Roll that a beat adds, in radians, and the seconds of its decay. */
const BANK_KICK = 0.13;
const BANK_DECAY_S = 0.5;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
${NOISE_CHUNK}
${RAMP_CHUNK}

#define FLASHES ${FLASH_SLOTS}

// Copies of the module constants above, thus the marcher reads as GLSL
// and not as string interpolation.
const float FAR = ${FAR}.0;
const float STEP_SCALE = ${STEP_SCALE};

uniform float uTime;
uniform float uAspect;

uniform float uBass;
uniform float uTreble;
uniform float uCentroid;

uniform float uBassAmp;
uniform float uBassScale;
uniform float uTrebleAmp;
uniform float uTrebleScale;
uniform float uGlow;
uniform float uRadius;
uniform float uDistance;
uniform float uSpin;

uniform float uTunnelGlow;
uniform float uTunnelFlash;
uniform float uTunnelRings;
uniform float uTunnelSegments;
uniform float uTunnelCurve;
/** Position of the camera along the tunnel. The CPU integrates it. */
uniform float uZCam;
/** The smoothed steer, and the roll from the last beat. */
uniform vec2  uSteer;
uniform float uBank;
/** Screen size of one device pixel, in the units of p. */
uniform float uPixel;
uniform int   uFlashCount;
uniform vec4  uFlashes[FLASHES]; // depth at birth, born, strength, jitter

varying vec2 vUv;

/**
 * The scene: a sphere with noise on its radius. The noise is sampled on
 * the direction, thus it is a radial height field and not a 3D volume.
 * Thus each step costs one noise lookup for each octave, and the surface
 * looks like a planet and not like a cloud.
 */
float sceneSdf(vec3 p) {
  float r = length(p);
  vec3 dir = p / max(r, 1e-4);

  float swell = fbm(dir * uBassScale + vec3(0.0, 0.0, uTime * 0.13), 3);
  float crust = fbm(dir * uTrebleScale + vec3(uTime * 0.35, 0.0, 0.0), 2);

  float surface = uRadius
    + uBassAmp * uBass * swell
    + uTrebleAmp * uTreble * crust;

  return r - surface;
}

/** Central differences. This adds six field evaluations. */
vec3 sceneNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    sceneSdf(p + e.xyy) - sceneSdf(p - e.xyy),
    sceneSdf(p + e.yxy) - sceneSdf(p - e.yxy),
    sceneSdf(p + e.yyx) - sceneSdf(p - e.yyx)
  ));
}

/**
 * The centre line of the tunnel: the position of the corridor at a
 * given depth.
 *
 * uTunnelCurve scales the full curve. A negative value gives the same
 * corridor mirrored: each bend to the right becomes a bend to the left.
 * Zero gives a straight pipe. The bank follows at no cost, because it
 * comes from the derivative of this curve.
 */
vec2 tunnelPath(float z, float zCam) {
  vec2 base = vec2(sin(z * 0.22) * 1.8 + sin(z * 0.07) * 3.0,
                   cos(z * 0.17) * 1.4) * uTunnelCurve;
  // The steer bends only the far part of the corridor. A bend next to
  // the camera is not a turn. It is a jerk.
  return base + uSteer * smoothstep(0.0, 6.0, z - zCam) * 1.5;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

/**
 * The tunnel that holds the core: the classic polar corridor, bent along
 * a path and drawn in view space over the screen-space quad.
 *
 * Screen space is the correct frame here, and it was the incorrect frame
 * for a box. A tunnel is symmetric about the axis that you look down,
 * thus no orbit can move it: the corridor always points at the camera
 * and only the rock in it turns. A box has corners, and corners must
 * have a position, thus a box had to be a real box in world space.
 *
 * The perspective is depth = K / r. The angle of a point about the
 * centre is the coordinate along the wall, and the reciprocal of its
 * radius is the coordinate into the screen. This is what a perspective
 * divide does, thus the corridor recedes correctly with no camera, no
 * matrix and no triangle.
 *
 * The bend must depend on the depth. A constant shift of the full screen
 * moves only the vanishing point, which looks like a camera that points
 * sideways down a straight pipe. To turn the tunnel, each pixel must
 * move by the position of the path at its own depth. A world offset at
 * distance d projects divided by d, and r is K / d, thus a division by d
 * is a multiplication by r. That is the full correction below. The code
 * subtracts the position of the camera on the path, because the camera
 * travels down the same curve. Without that subtraction the bend becomes
 * weaker as the flight continues.
 *
 * There is no texture to sample, thus the code draws the wall: rings
 * across it and lines that run away from the camera. It measures both
 * back into screen distance before it gives them a width. This keeps the
 * rings sharp where they crowd together near the vanishing point, and it
 * does not use fwidth, which needs an extension in GLSL ES 1.00. The fog
 * would hide most of the aliasing, but a ring must stay sharp until it
 * fades.
 */
vec3 tunnelColour(vec2 screen, vec3 tint, float bass) {
  // Two times the screen coordinate of the marcher: -1 to 1 from the top
  // to the bottom, which is the frame of the classic version.
  vec2 p = screen * 2.0;

  // Bank into the bend, as an aircraft does, plus the slow turn of the
  // wall and the kick from the last beat.
  vec2 tangent = tunnelPath(uZCam + 0.5, uZCam) - tunnelPath(uZCam - 0.5, uZCam);
  p = rot(-tangent.x * ${TUNNEL_BANK} + uTime * ${TUNNEL_SPIN} + uBank) * p;

  vec2 q = p;
  float r = max(length(q), 1e-3);
  float d = ${TUNNEL_DEPTH} / r;
  float z = uZCam + d;
  for (int i = 0; i < ${PATH_PASSES}; i++) {
    r = max(length(q), 1e-3);
    d = ${TUNNEL_DEPTH} / r;
    z = uZCam + d;
    q = p - (tunnelPath(z, uZCam) - tunnelPath(uZCam, uZCam)) * r;
  }
  r = max(length(q), 1e-3);
  d = ${TUNNEL_DEPTH} / r;
  z = uZCam + d;

  float angle = atan(q.y, q.x) / 6.2831853;

  // Rings. dz/dr is -K/r^2, thus a division by it puts the distance to
  // the nearest ring back into screen units.
  float rings = z * uTunnelRings;
  float ringDist = abs(rings - floor(rings + 0.5))
                 / max(uTunnelRings, 1e-4) * r * r / ${TUNNEL_DEPTH};
  float wall = 1.0 - smoothstep(0.0, uPixel * ${LINE_PX}, ringDist);

  // Lines along the tunnel. Their screen distance is an arc: the gap
  // between two lines is 2 pi r divided by the segment count.
  float around = angle * uTunnelSegments;
  float segDist = abs(around - floor(around + 0.5))
                * 6.2831853 / max(uTunnelSegments, 1e-4) * r;
  wall = max(wall, 1.0 - smoothstep(0.0, uPixel * ${LINE_PX}, segDist));

  // The flashes: a ring at a fixed position in the tunnel. The flight
  // moves it toward the camera, and it also has a speed of its own.
  float flash = 0.0;
  for (int i = 0; i < FLASHES; i++) {
    if (i >= uFlashCount) break;
    vec4 f = uFlashes[i];
    float age = (uTime - f.y) / ${FLASH_LIFE};
    if (age < 0.0 || age > 1.0) continue;
    float at = f.x - age * ${FLASH_RUSH};
    float dist = abs(z - at) * r * r / ${TUNNEL_DEPTH};
    float width = uPixel * ${FLASH_LINE_PX} * (0.6 + f.w);
    float edge = 1.0 - smoothstep(0.0, width, dist);
    // A soft shoulder on each side, thus the ring glows and does not
    // become a hairline as soon as it moves off a pixel.
    float halo = exp(-dist / (width * 6.0)) * 0.35;
    flash += (edge + halo) * (1.0 - age) * f.z;
  }

  // Fog on the distance ahead, not on the position along the tunnel.
  // This is what makes the vanishing point go dark on its own.
  float fog = exp(-d * ${TUNNEL_FOG});
  vec3 colour = tint * wall * uTunnelGlow * (0.35 + 0.65 * bass);
  // The flash is light, thus it moves toward white and does not keep the
  // hue of the centroid. A hit must look like light in the tunnel and not
  // like more of the same colour.
  colour += mix(tint, vec3(1.0), 0.55) * min(flash, 1.5) * uTunnelFlash;
  return colour * fog;
}

void main() {
  // A camera that orbits the core, built by hand. There is no three.js
  // camera here, because there is no geometry for it to look at.
  float angle = uTime * uSpin;
  // Do not let the knobs put the eye in the rock. The drift can find a
  // large radius with a near camera. From in the rock each ray reports a
  // negative distance and the frame becomes one flat colour.
  float reach = uRadius + uBassAmp + uTrebleAmp + 0.6;
  float orbit = max(uDistance, reach);
  vec3 origin = vec3(sin(angle) * orbit, orbit * 0.22, cos(angle) * orbit);
  vec3 forward = normalize(-origin);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);

  vec2 screen = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec3 ray = normalize(forward + right * screen.x * 1.2 + up * screen.y * 1.2);

  float travelled = 0.0;
  float nearest = FAR;
  bool hit = false;
  vec3 point = origin;

  for (int i = 0; i < ${STEPS}; i++) {
    point = origin + ray * travelled;
    // 'distance' is a GLSL builtin, thus this local has another name.
    float dist = sceneSdf(point);
    // Keep the closest approach of the ray, also when it misses. This is
    // the silhouette glow, and the marcher already has the value.
    nearest = min(nearest, dist);
    if (dist < 0.0015 * max(1.0, travelled)) {
      hit = true;
      break;
    }
    travelled += dist * STEP_SCALE;
    if (travelled > FAR) break;
  }

  vec3 tint = ramp(uCentroid);
  vec3 colour = vec3(0.02, 0.016, 0.039);

  if (hit) {
    vec3 normal = sceneNormal(point);
    vec3 light = normalize(vec3(0.4, 0.8, 0.45));
    float diffuse = max(dot(normal, light), 0.0);
    // Rim light, thus the shape is visible against a dark background
    // also where there is no light.
    float rim = pow(1.0 - max(dot(normal, -ray), 0.0), 3.0);
    vec3 half_ = normalize(light - ray);
    float spec = pow(max(dot(normal, half_), 0.0), 48.0);

    colour += tint * (0.12 + 0.88 * diffuse);
    colour += tint * rim * 1.1;
    colour += vec3(spec) * 0.5;
  } else {
    // Behind the rock: the tunnel first, then the silhouette bloom on
    // top. Thus the glow looks like light around the core and not like a
    // wall.
    colour += tunnelColour(screen, tint, uBass);
    // Bloom from the closest approach. It decays quickly, thus it stays
    // near the silhouette and does not brighten the full frame.
    float halo = exp(-max(nearest, 0.0) * 6.0);
    colour += tint * halo * uGlow;
  }

  gl_FragColor = vec4(colour, 1.0);
}
`;

/** The bands are in thirds. The first third and the last third drive the shape. */
const LOW_END = 1 / 3;
const HIGH_START = 2 / 3;
/** Smoothing on the envelopes, thus the rock does not shake each frame. */
const RISE = 0.35;
const FALL = 0.08;

/**
 * The onset test for a flash. It uses the low end that the loop already
 * folds. The mean follows the signal across near a third of a second. A
 * hit must be above the mean by half again, and it must also be loud
 * enough. Two rings cannot occur in less than `FLASH_GAP` seconds, at
 * each density of the music.
 */
const FLASH_MEAN_RATE = 0.05;
const FLASH_RATIO = 1.5;
const FLASH_FLOOR = 0.12;
const FLASH_GAP = 0.13;

export function RaymarchCore({
  bands,
  sample,
  paused = false,
  drift = true,
  className = "h-full w-full",
}: {
  bands: number;
  /** Fills `out` with the current levels, 0..1 for each band, each frame. */
  sample: (out: Float32Array) => void;
  paused?: boolean;
  /**
   * Whether the knobs of this core wander (`useDrift`). It is on by
   * default, because a scene with no panel would not change. A caller
   * that selected its values sets it to false for its own core and does
   * not stop the walk on the other cores. Thus this is a prop and not the
   * default in the store.
   */
  drift?: boolean;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  /** The walk runs with the scene, thus it runs with or without a panel. */
  const [drifting, setDrifting] = useState(raymarchDrifting);
  useEffect(() => subscribeRaymarchDrifting(setDrifting), []);
  useDrift({
    enabled: drift && drifting,
    keys: RAYMARCH_KEYS,
    specs: RAYMARCH_SPECS,
    read: raymarchState,
    write: setRaymarchControl,
    intervalMs: RAYMARCH_DRIFT_MS,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    } catch {
      return; // There is no WebGL2.
    }
    renderer.setClearColor(0x05040a, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    let config: RaymarchState = { ...raymarchState() };

    /** Depth at birth, birth time, strength and jitter: one vec4 for each slot. */
    const flashes = new Float32Array(FLASH_SLOTS * 4);
    let flashHead = 0;
    let flashCount = 0;
    let lastFlashAt = -Infinity;

    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uCentroid: { value: 0.5 },
      uBassAmp: { value: config.bassAmp },
      uBassScale: { value: config.bassScale },
      uTrebleAmp: { value: config.trebleAmp },
      uTrebleScale: { value: config.trebleScale },
      uGlow: { value: config.glow },
      uRadius: { value: config.radius },
      uDistance: { value: config.distance },
      uSpin: { value: config.spin },
      uTunnelGlow: { value: config.tunnelGlow },
      uTunnelFlash: { value: config.tunnelFlash },
      uTunnelRings: { value: config.tunnelRings },
      uTunnelSegments: { value: config.tunnelSegments },
      uTunnelCurve: { value: config.tunnelCurve },
      uZCam: { value: 0 },
      uSteer: { value: new THREE.Vector2() },
      uBank: { value: 0 },
      uPixel: { value: 0.002 },
      uFlashCount: { value: 0 },
      // Mutated in place and never replaced. A beat writes it and each
      // frame reads it, as with the spectrum.
      uFlashes: { value: flashes },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      // The march costs for each pixel, thus the ratio is the quality
      // control. The canvas keeps its CSS size and the browser scales the
      // result up.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr * config.resolution);
      renderer.setSize(clientWidth, clientHeight);
      uniforms.uAspect.value = clientWidth / clientHeight;
      // One device pixel in the units of the tunnel. The tunnel works in
      // p, which runs -1 to 1 across the height, thus a pixel is 2
      // divided by the height of the buffer. Use the buffer and not the
      // canvas, thus the lines stay one rendered pixel wide when the
      // Resolution knob moves.
      const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
      uniforms.uPixel.value = 2 / Math.max(buffer.y, 1);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const unsubscribe = subscribeRaymarch((next) => {
      const rescaled = next.resolution !== config.resolution;
      config = { ...next };
      uniforms.uBassAmp.value = config.bassAmp;
      uniforms.uBassScale.value = config.bassScale;
      uniforms.uTrebleAmp.value = config.trebleAmp;
      uniforms.uTrebleScale.value = config.trebleScale;
      uniforms.uGlow.value = config.glow;
      uniforms.uRadius.value = config.radius;
      uniforms.uDistance.value = config.distance;
      uniforms.uSpin.value = config.spin;
      uniforms.uTunnelGlow.value = config.tunnelGlow;
      uniforms.uTunnelFlash.value = config.tunnelFlash;
      uniforms.uTunnelRings.value = config.tunnelRings;
      uniforms.uTunnelSegments.value = config.tunnelSegments;
      uniforms.uTunnelCurve.value = config.tunnelCurve;
      if (rescaled) resize();
    });

    // --- loop ------------------------------------------------------------
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const levels = new Float32Array(bands);
    const origin = performance.now();
    /** The time when the clock stopped, or -1 while it runs. */
    let frozenAt = -1;
    /** Total ms in the frozen state, thus a resume continues and does not jump. */
    let frozen = 0;
    let bass = 0;
    let treble = 0;
    let centroid = 0.5;
    /** Rolling mean of the low end, for the onset test of the flash. */
    let bassMean = 0;
    /**
     * The distance of the camera along the tunnel. The code integrates
     * it and does not compute time x speed, because the speed moves with
     * the music and with the knob. A changing speed multiplied by the
     * absolute time moves the full corridor at each change.
     */
    let zCam = 0;
    let lastClock = 0;
    let steerX = 0;
    let steerY = 0;
    let bank = 0;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      // Freeze the clock and not the frame, as the water tile does. The
      // canvas continues to paint, thus it does not go blank, but the
      // shape, the orbit and the spectrum hold their values.
      const still = motion.matches || pausedRef.current;
      if (still && frozenAt < 0) frozenAt = now;
      if (!still && frozenAt >= 0) {
        // Keep the time spent in the frozen state. Without it the shape
        // and the orbit would jump forward by the length of the pause.
        frozen += now - frozenAt;
        frozenAt = -1;
      }
      uniforms.uTime.value = ((still ? frozenAt : now) - origin - frozen) / 1000;

      if (!still) {
        sampleRef.current(levels);

        // Fold 28 bands into what a surface can show: two energies and a
        // centroid. The rise is fast and the fall is slow, thus a hit
        // swells the rock and the rock then subsides without a flicker.
        let low = 0;
        let high = 0;
        let lowCount = 0;
        let highCount = 0;
        let weighted = 0;
        let total = 0;
        for (let band = 0; band < bands; band++) {
          const level = levels[band];
          const position = bands > 1 ? band / (bands - 1) : 0.5;
          if (position <= LOW_END) {
            low += level;
            lowCount++;
          } else if (position >= HIGH_START) {
            high += level;
            highCount++;
          }
          weighted += position * level;
          total += level;
        }
        const lowNow = lowCount > 0 ? low / lowCount : 0;
        const highNow = highCount > 0 ? high / highCount : 0;

        bass += (lowNow - bass) * (lowNow > bass ? RISE : FALL);
        treble += (highNow - treble) * (highNow > treble ? RISE : FALL);
        // Spectral centroid: the position of the energy, 0 at the bass
        // and 1 at the treble.
        const centroidNow = total > 1e-4 ? weighted / total : 0.5;
        centroid += (centroidNow - centroid) * 0.06;

        uniforms.uBass.value = bass;
        uniforms.uTreble.value = treble;
        uniforms.uCentroid.value = centroid;

        // The flight. `dt` comes from the scene clock, which freezes on a
        // pause, thus the tunnel stops with the other parts. The code
        // clamps `dt`, thus a backgrounded tab does not return after a
        // very long flight.
        const clock = uniforms.uTime.value;
        const dt = Math.min(0.1, Math.max(0, clock - lastClock));
        lastClock = clock;
        zCam += dt * config.tunnelSpeed * (1 + bass * SPEED_BOOST);
        uniforms.uZCam.value = zCam;

        // Steering. There is no stereo signal for a left-right
        // difference, because the preview is summed into one analyser.
        // Thus the position of the energy steers the corridor: the
        // centroid moves it from side to side, and the balance of the
        // bass against the treble lifts it.
        steerX += ((centroid - 0.5) * 2 - steerX) * STEER_RATE;
        steerY += (bass - treble - steerY) * STEER_RATE;
        (uniforms.uSteer.value as THREE.Vector2).set(steerX, steerY);

        bank *= Math.exp(-dt / BANK_DECAY_S);
        uniforms.uBank.value = bank;

        // A flash is an onset and not a level. The test is whether the
        // low end went above its recent value. A level threshold would
        // fire at each frame of a loud track, which is 60 rings a second
        // and a strobe.
        //
        // This is not the shared detector (`audio-drops.ts`). That one
        // finds which band hit and allocates the ripple slots of the
        // water. The tunnel needs one trigger from the bass that this
        // loop already folded. `clock` is the scene clock read above.
        const onset =
          lowNow > FLASH_FLOOR &&
          lowNow > bassMean * FLASH_RATIO &&
          clock - lastFlashAt > FLASH_GAP;
        // Update after the test, thus the code compares a hit with the
        // previous bass and not with a mean that the hit increased.
        bassMean += (lowNow - bassMean) * FLASH_MEAN_RATE;

        if (onset) {
          lastFlashAt = clock;
          const at = flashHead * 4;
          // Stored as a depth and not as a radius. The tunnel scrolls,
          // thus a constant depth gives a ring that travels. The ring
          // starts near the centre, which is a large depth for a
          // reciprocal.
          const radius =
            FLASH_START_MIN + Math.random() * (FLASH_START_MAX - FLASH_START_MIN);
          flashes[at] = TUNNEL_DEPTH / radius + zCam;
          flashes[at + 1] = clock;
          flashes[at + 2] = Math.min(1, lowNow);
          flashes[at + 3] = Math.random();
          flashHead = (flashHead + 1) % FLASH_SLOTS;
          flashCount = Math.min(flashCount + 1, FLASH_SLOTS);
          uniforms.uFlashCount.value = flashCount;
          // A beat also rolls the camera to one side. This is the same
          // cue as the bank into a bend, but it comes from a hit and not
          // from the curve.
          bank = (Math.random() < 0.5 ? -1 : 1) * BANK_KICK * Math.min(1, lowNow);
        }
      }

      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // Rebuilt only when the band count changes. The other values reach
    // the loop through refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands]);

  return <div ref={mountRef} className={className} />;
}
