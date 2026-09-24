"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RAMP_CHUNK } from "@/app/_glsl/ramp";
import { beatClock } from "./beat-clock";
import { createMilkdropAudio, milkdropAspect } from "./milkdrop";
import { VISUALIZER_BANDS } from "./visualizer-styles";

/**
 * Mandelbrot (DESIGN.md §6.16): a dive into the set, with the spectrum
 * painted on its own contours.
 *
 * It is the second visualizer with no geometry at all. The raymarched
 * core is the first: one fullscreen quad, and the whole image derived
 * for each pixel. Here the per-pixel answer is the escape time of
 * `z -> z^2 + c`, which is the oldest picture in computer graphics that
 * is worth looking at, and the reason to put it in a music player is
 * that it already has the shape every other style has to invent: the
 * escape count falls in **contours** around the set, one inside the
 * next, as far in as anyone cares to look. A rack graphic EQ bends its
 * bands around a fractal.
 *
 * ## What the audio does
 *
 * - **The contours are the bands.** The continuous escape count, taken
 *   modulo a cycle, indexes the 28 bands: contour k is lit by band k.
 *   Thus the hue reads **frequency** here, as it does on the curl
 *   field, and the brightness reads level, as it does on the LED
 *   matrix. The cycle folds back on itself (bass out to treble and back
 *   to bass) so the colour has no seam; a ramp that ran 0 to 1 and then
 *   jumped would draw a hard red-to-blue edge on each contour.
 * - **The bass flies the camera.** It adds to the rate of the dive.
 *   The rate is **integrated** and not multiplied by the clock, for the
 *   reason the flight of the core is: a speed that moves, times an
 *   absolute time, jumps the whole image each time the speed changes.
 * - **The treble lights the filaments.** Body from the low end and fine
 *   crust from the high end is the split of the core, and it is the
 *   split the picture already has: the set is one mass with a boundary
 *   of infinite detail hung off it.
 * - **The middle moves the contours.** One offset, integrated like the
 *   dive, so the colour crawls outward instead of standing still.
 *
 * ## Why the dive is cut and not looped
 *
 * `float` has 24 bits of mantissa, thus a coordinate near 1 is known to
 * about 1e-7 and two pixels of the frame collide when the frame is
 * narrower than a few times that. The dive therefore bottoms out near
 * 20,000 times, which is `MAX_EFOLDS`. To go deeper is a different
 * program: the orbit of one reference point is computed in double on
 * the CPU and each pixel iterates its *difference* from that orbit,
 * which stays small and thus stays accurate in float. That is
 * perturbation, it is how the deep-zoom renderers work, and it is far
 * more machinery than a tile in a music player needs.
 *
 * So the dive ends, and the question is only what to do at the end.
 * `WarpVisualizer.tsx` answers the same question for its field: a state
 * that changes **on** a beat reads as an edit and the same change at an
 * arbitrary moment reads as a fault. Thus the dive holds at the floor
 * until `beat-clock.ts` gives a beat, and cuts to a new target there.
 * With no beat to be found (`locked` false: speech, ambient, a fade) it
 * cuts on a timer, which is the behaviour it would have had anyway.
 *
 * The shell of this file, the normaliser that turns the bands into the
 * bass, middle and treble that drive it, and the shoulder that keeps
 * the bright places coloured are all from `HarlequinVisualizer.tsx` and
 * `milkdrop.ts`.
 */

/**
 * The longest side of the frame that is marched, in pixels.
 *
 * The cost is per pixel and not per object, as it is on the core: the
 * canvas keeps its CSS size and the shader marches fewer pixels than it
 * has. A fractal is a sharp picture and this does show, but a
 * full-screen copy at the ratio of the device is four times the work
 * for a picture that moves.
 */
const MAX_SIDE = 900;

/** The ceiling on the loop, and the count that a dive uses at each end of it. */
const ITER_CAP = 512;
const ITER_MIN = 140;
const ITER_PER_EFOLD = 26;

/**
 * The square of the bailout radius.
 *
 * A bailout of 2 is enough to know that a point escapes, and far too
 * small to know *when*: the continuous count below is only smooth in
 * the limit of a large radius. 256 is the usual answer and costs
 * nothing, because a point that is past 2 reaches 256 in two or three
 * more steps.
 */
const BAILOUT2 = 65536;

/** The half-width of the frame, along its longer axis, with the dive at its start. */
const HALF_START = 1.6;
/** Where the camera looks before it turns toward the target of the dive. */
const OVERVIEW: [number, number] = [-0.6, 0];

/** Refer to the head of the file: the floor that `float` puts on the dive. */
const MAX_EFOLDS = 10;
/** Over how much of the dive the camera turns from the overview onto the target. */
const APPROACH_EFOLDS = 1.5;

/** The rate of the dive with no signal, and how much the bass adds, in e-folds a second. */
const DIVE_BASE = 0.22;
const DIVE_BASS = 0.2;

/** The rate the contours crawl at, and how much the middle adds, in cycles a second. */
const FLOW_BASE = 0.035;
const FLOW_MID = 0.05;

/** Iterations for one cycle of the spectrum across the contours. */
const RING_CYCLE = 18;

/** How hard the treble lights the filaments, and the bass the inside of the set. */
const RIM_TREBLE = 0.4;
const BODY_BASS = 0.35;

/** Seconds at the floor of the dive before the code looks for a beat to cut on. */
const MIN_HOLD_S = 1.2;
/** With no beat to wait for, the cut is this much later than that. */
const NO_BEAT_GRACE_S = 1.6;

/** Below this mean level the input counts as silence and the idle curve takes over. */
const SILENCE = 0.01;

/**
 * Where a dive goes.
 *
 * These are published coordinates on the boundary of the set, and they
 * are hand-picked for one reason: a point drawn at random on the
 * boundary is almost always dull, because most of the boundary is a
 * plain filament and the places worth 20,000 times are the ones people
 * have already found and named. The set is symmetric about the real
 * axis, thus the sign of y is free.
 */
const TARGETS: { x: number; y: number }[] = [
  { x: -0.743643887037151, y: 0.13182590420533 }, // Seahorse Valley
  { x: -0.10109636384562, y: 0.95628651080914 }, // a Misiurewicz point
  { x: -1.25066, y: 0.02012 }, // Scepter Valley
  { x: -0.235125, y: 0.827215 }, // Triple Spiral Valley
  { x: 0.001643721971153, y: -0.822467633298876 }, // the Julia islands
  { x: -0.77568377, y: 0.13646737 }, // Quad Spiral Valley
  { x: 0.2929859127507, y: 0.6117848324958 }, // Elephant Valley
];

const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * The whole picture, for each pixel.
 *
 * Use only ASCII characters. Refer to `app/_glsl/noise.ts` for the
 * reason.
 */
const MANDELBROT_FRAGMENT = /* glsl */ `
${RAMP_CHUNK}

uniform sampler2D uSpectrum;
uniform vec2  uAspect;
uniform vec2  uCenter;
uniform float uHalf;
uniform float uRot;
uniform float uPixel;
uniform int   uIter;
uniform float uBands;
uniform float uCycle;
uniform float uFlow;
uniform float uBass;
uniform float uTreb;
uniform float uMean;
uniform float uCentroid;

varying vec2 vUv;

vec2 csqr(vec2 z) { return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y); }
vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// The level of the band at s, blended between the two neighbours. The
// texture is NEAREST, because the linear filter of a float texture
// needs an extension that is not everywhere, thus the blend is here.
float bandLevel(float s) {
  float x = s * uBands - 0.5;
  float i = floor(x);
  float f = x - i;
  float a = texture2D(uSpectrum, vec2((i + 0.5) / uBands, 0.5)).r;
  float b = texture2D(uSpectrum, vec2((i + 1.5) / uBands, 0.5)).r;
  return mix(a, b, f);
}

void main() {
  vec2 clip = (vUv - 0.5) * 2.0 * uAspect;
  float cr = cos(uRot);
  float sr = sin(uRot);
  vec2 c = uCenter + mat2(cr, -sr, sr, cr) * clip * uHalf;

  // The main cardioid and the period-2 bulb, in closed form. Both are
  // inside the set, thus every pixel in them runs the loop to the cap
  // and gets a black pixel for it. With the set in frame that is most
  // of the screen, thus this test is the difference between a tile that
  // runs and one that does not.
  float q = (c.x - 0.25) * (c.x - 0.25) + c.y * c.y;
  bool known = q * (q + c.x - 0.25) <= 0.25 * c.y * c.y
            || (c.x + 1.0) * (c.x + 1.0) + c.y * c.y <= 0.0625;

  vec2 z = vec2(0.0);
  // The derivative of z with respect to c, carried beside z by the
  // chain rule: dz' = 2*z*dz + 1. It costs one complex multiply for
  // each step and it is what gives the distance below.
  vec2 dz = vec2(0.0);
  float n = 0.0;
  float m2 = 0.0;
  bool escaped = false;

  if (!known) {
    // The loop has a constant bound and leaves at uIter, as the wave
    // field leaves at uDropCount: a deep frame needs more steps than a
    // wide one, and the cap is what stops the cost of the worst pixel
    // from being a surprise.
    for (int i = 0; i < ${ITER_CAP}; i++) {
      if (i >= uIter) break;
      dz = 2.0 * cmul(z, dz) + vec2(1.0, 0.0);
      z = csqr(z) + c;
      m2 = dot(z, z);
      n += 1.0;
      if (m2 > ${BAILOUT2}.0) { escaped = true; break; }
    }
  }

  // The continuous escape count. The whole count alone draws the
  // contours as hard steps, and a step that moves by one whole band
  // each time the camera creeps forward flickers; this reads the
  // overshoot past the bailout and turns the steps into a ramp.
  float mu = escaped ? n + 1.0 - log2(max(1e-6, log(sqrt(m2)))) : float(uIter);
  float phase = mu / uCycle - uFlow;

  // How much of a cycle one pixel covers. The contours crowd without
  // limit toward the boundary, thus past about half a cycle for each
  // pixel there is nothing left to draw but moire. This call must be
  // reached by every pixel of a quad, thus it is here and not in the
  // branch below. Refer to the core, which measures its lines back
  // into screen distance for the same reason.
  float fine = fwidth(phase);

  // The cycle folds back on itself: bass out to treble and back. Thus
  // the colour is continuous across a contour and the picture has no
  // seam where the ramp would otherwise wrap from red to blue.
  float s = 1.0 - abs(2.0 * fract(phase) - 1.0);
  float sharp = 1.0 - smoothstep(0.2, 0.6, fine);

  vec3 lit = ramp(s) * (0.10 + 1.15 * bandLevel(s));
  // Where the contours are finer than a pixel, the pixel shows what
  // they average to: the colour of the centroid at the mean level.
  vec3 soft = ramp(uCentroid) * (0.10 + 1.15 * uMean);
  vec3 col = mix(soft, lit, sharp);

  // The distance from this pixel to the set, from z and its derivative,
  // measured in pixels. It is what keeps a filament visible at any
  // depth: a filament is thinner than a pixel almost everywhere, thus
  // a test on colour alone loses it and a test on distance does not.
  float de = sqrt(m2) * log(max(1.0001, sqrt(m2))) / max(1e-12, length(dz));
  col += exp(-de / uPixel * 0.75) * (0.22 + uTreb) * ramp(0.86);

  // The inside of the set keeps a faint cool tint and breathes with the
  // bass, as the unlit cells of the LED matrix keep one: a black hole
  // in the middle of the frame reads as a hole and not as a body.
  vec3 body = vec3(0.014, 0.018, 0.040) * (1.0 + uBass);

  // As on Warp and Harlequin: the filament crosses the contours and
  // goes past 1, and the shoulder keeps those places coloured instead
  // of clipping them to white.
  vec3 rgb = escaped ? col : body;
  gl_FragColor = vec4(vec3(1.0) - exp(-rgb * 1.25), 1.0);
}
`;

const between = (low: number, high: number) => low + Math.random() * (high - low);
/** Away from zero: a rotation of nothing leaves the frame square to the screen. */
const signed = (low: number, high: number) =>
  (Math.random() < 0.5 ? -1 : 1) * between(low, high);

/** Where the camera is, and what it will do until the next cut. */
interface Dive {
  target: (typeof TARGETS)[number];
  /** How far in, in e-folds. The frame is `HALF_START * exp(-efolds)` across. */
  efolds: number;
  /** The turn of the frame, and its rate in radians a second. */
  rot: number;
  rotRate: number;
  /**
   * A slow pan, in half-frames a second, and what it has come to.
   *
   * It is held in half-frames and not in coordinates, thus it is a
   * constant speed on the screen at any depth. A pan of a fixed number
   * of coordinates a second is a crawl at the start of a dive and a
   * bolt at the end of one.
   */
  panX: number;
  panY: number;
  panRate: [number, number];
  /** Seconds that the dive has been at the floor, waiting for a beat. */
  held: number;
}

function newDive(previous?: Dive): Dive {
  let target = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  // Two dives to one place in a row read as the cut having failed.
  if (previous && target === previous.target) {
    const next = TARGETS.indexOf(target) + 1;
    target = TARGETS[next % TARGETS.length];
  }
  const angle = Math.random() * Math.PI * 2;
  const speed = between(0.004, 0.016);
  return {
    target,
    efolds: 0,
    rot: Math.random() * Math.PI * 2,
    rotRate: signed(0.01, 0.06),
    panX: 0,
    panY: 0,
    panRate: [Math.cos(angle) * speed, Math.sin(angle) * speed],
    held: 0,
  };
}

export function MandelbrotVisualizer({
  paused = false,
  spectrum,
  className,
}: {
  paused?: boolean;
  spectrum?: Float32Array;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const spectrumRef = useRef(spectrum);
  spectrumRef.current = spectrum;
  const startRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    } catch {
      return; // No WebGL2; the tile stays black rather than breaking.
    }
    renderer.setClearColor(0x05040a, 1);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // The 28 bands as a texture, as the curl field reads them: a
    // uniform array would do, but the texture is one upload and the
    // shader reads it with a coordinate it already has.
    const levels = new Float32Array(VISUALIZER_BANDS);
    const spectrumTexture = new THREE.DataTexture(
      levels,
      VISUALIZER_BANDS,
      1,
      THREE.RedFormat,
      THREE.FloatType,
    );
    spectrumTexture.minFilter = THREE.NearestFilter;
    spectrumTexture.magFilter = THREE.NearestFilter;
    spectrumTexture.needsUpdate = true;

    const uniforms: Record<string, THREE.IUniform> = {
      uSpectrum: { value: spectrumTexture },
      uAspect: { value: new THREE.Vector2(1, 1) },
      uCenter: { value: new THREE.Vector2(OVERVIEW[0], OVERVIEW[1]) },
      uHalf: { value: HALF_START },
      uRot: { value: 0 },
      uPixel: { value: HALF_START / 450 },
      uIter: { value: ITER_MIN },
      uBands: { value: VISUALIZER_BANDS },
      uCycle: { value: RING_CYCLE },
      uFlow: { value: 0 },
      uBass: { value: 0 },
      uTreb: { value: 0 },
      uMean: { value: 0 },
      uCentroid: { value: 0.5 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: MANDELBROT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(quad, material);
    // The vertex shader writes clip space itself, thus the bounding
    // sphere that three computes from the vertex data is not where the
    // quad is and the quad would be culled.
    mesh.frustumCulled = false;
    scene.add(mesh);

    const readAudio = createMilkdropAudio();
    const origin = performance.now();
    let dive = newDive();
    let flow = 0;
    let longSide = 900;
    let lastFrameAt = -1;
    let frame = 0;
    let lastBeat = -1;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      // The ratio is capped so the marched frame keeps to MAX_SIDE. The
      // canvas keeps its CSS size; the browser scales the result up.
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        MAX_SIDE / Math.max(width, height),
      );
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      const [ax, ay] = milkdropAspect(width, height);
      uniforms.uAspect.value.set(ax, ay);
      longSide = Math.max(2, Math.round(Math.max(width, height) * ratio));
    };

    /** A slow travelling wave, so the contours have something to say in silence. */
    const idleLevels = (t: number) => {
      for (let band = 0; band < VISUALIZER_BANDS; band++) {
        const u = band / (VISUALIZER_BANDS - 1);
        levels[band] = Math.max(
          0.02,
          0.12 + 0.1 * Math.sin(t * 1.3 - u * 6.2) + 0.06 * Math.sin(t * 2.1 + u * 11.0),
        );
      }
    };

    const draw = () => {
      renderer.render(scene, camera);
    };

    const tick = (now: number) => {
      if (motion.matches || pausedRef.current) {
        // As the other WebGL styles do: the clock freezes and the frame
        // holds where it was. One more draw, so a player that opens
        // paused shows a picture and not an empty canvas.
        draw();
        frame = 0;
        return;
      }

      const t = (now - origin) / 1000;
      const dt = lastFrameAt < 0 ? 1 / 60 : Math.min(0.1, (now - lastFrameAt) / 1000);
      lastFrameAt = now;

      const source = spectrumRef.current;
      let energy = 0;
      if (source && source.length >= VISUALIZER_BANDS) {
        for (let band = 0; band < VISUALIZER_BANDS; band++) {
          levels[band] = source[band];
          energy += source[band];
        }
      }
      if (energy <= VISUALIZER_BANDS * SILENCE) idleLevels(t);
      spectrumTexture.needsUpdate = true;

      // Where the energy sits and how much of it there is. The first
      // is the colour of a pixel whose contours are too fine to draw
      // and the second is its level, thus the two together are what
      // the contours average to.
      let sum = 0;
      let weighted = 0;
      for (let band = 0; band < VISUALIZER_BANDS; band++) {
        sum += levels[band];
        weighted += levels[band] * band;
      }
      const mean = sum / VISUALIZER_BANDS;
      const centroid = sum > 1e-4 ? weighted / sum / (VISUALIZER_BANDS - 1) : 0.5;

      // 1.0 is the usual level of the band for the track that plays,
      // and not a fraction of full scale. Refer to `milkdrop.ts`: a
      // rate that reads a 0..1 fraction hardly moves.
      const audio = readAudio(source, dt);

      // The dive and the crawl of the contours are both integrated. A
      // rate that moves, times the clock, jumps the whole image each
      // time the rate changes; this is the lesson of the flight of the
      // raymarched core.
      const atFloor = dive.efolds >= MAX_EFOLDS;
      if (!atFloor) {
        dive.efolds = Math.min(
          MAX_EFOLDS,
          dive.efolds + (DIVE_BASE + DIVE_BASS * audio.bassAtt) * dt,
        );
      } else {
        dive.held += dt;
      }
      flow += (FLOW_BASE + FLOW_MID * audio.midAtt) * dt;
      dive.rot += dive.rotRate * dt;
      dive.panX += dive.panRate[0] * dt;
      dive.panY += dive.panRate[1] * dt;

      // The cut. The floor is `float` and not a choice; the beat only
      // decides at which moment the picture is allowed to change.
      const clock = beatClock(now);
      if (atFloor && dive.held >= MIN_HOLD_S) {
        const onBeat = clock.locked && clock.beat !== lastBeat;
        if (onBeat || dive.held >= MIN_HOLD_S + NO_BEAT_GRACE_S) {
          dive = newDive(dive);
        }
      }
      lastBeat = clock.beat;

      const half = HALF_START * Math.exp(-dive.efolds);
      // The camera turns from the overview onto the target over the
      // first of the dive, thus a cut lands on the whole set and flies
      // in, and does not begin already committed to a point.
      const approach = Math.min(1, dive.efolds / APPROACH_EFOLDS);
      const ease = approach * approach * (3 - 2 * approach);
      const cx = OVERVIEW[0] + (dive.target.x - OVERVIEW[0]) * ease;
      const cy = OVERVIEW[1] + (dive.target.y - OVERVIEW[1]) * ease;

      uniforms.uCenter.value.set(cx + dive.panX * half, cy + dive.panY * half);
      uniforms.uHalf.value = half;
      uniforms.uPixel.value = (2 * half) / longSide;
      uniforms.uRot.value = dive.rot;
      // A deep frame is nearer the boundary everywhere, thus it needs
      // more steps to tell the inside from a slow escape.
      uniforms.uIter.value = Math.min(
        ITER_CAP,
        Math.round(ITER_MIN + ITER_PER_EFOLD * dive.efolds),
      );
      uniforms.uFlow.value = flow;
      uniforms.uBass.value = Math.min(3, audio.bassAtt) * BODY_BASS;
      uniforms.uTreb.value = Math.min(2.5, audio.trebAtt) * RIM_TREBLE;
      uniforms.uMean.value = mean;
      uniforms.uCentroid.value = centroid;

      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame) return;
      lastFrameAt = -1;
      frame = requestAnimationFrame(tick);
    };

    startRef.current = start;
    resize();
    start();

    const observer = new ResizeObserver(() => {
      resize();
      start();
    });
    observer.observe(canvas);
    motion.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", start);
      startRef.current = null;
      spectrumTexture.dispose();
      quad.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // `tick` stops the loop at a pause, thus a resume must start it again.
  useEffect(() => {
    if (!paused) startRef.current?.();
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block h-full w-full bg-[#05040a] ${className ?? ""}`}
    />
  );
}
