"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  MAX_DROPS,
  WATER_FIELD_CHUNK,
  WATER_FRAGMENT_PRELUDE,
  WATER_VERTEX_SHADER,
  flatDropK,
} from "@/app/_water/water-field";
import {
  bandRadius,
  bandWavenumber,
  createOnsetDetector,
} from "./audio-drops";
import { VISUALIZER_BANDS } from "./visualizer-styles";

/**
 * The water visualizer (DESIGN.md §6.16): the same WebGL wave field the
 * blade background uses (§3.1), with the music dropping the stones.
 *
 * Nothing about the physics is new here. `ripplePacket` in
 * `app/_water/water-field.ts` is already a damped radial sinusoid under a
 * Gaussian envelope, which is exactly the shape a drop makes; this only
 * decides when and where one lands. `audio-drops.ts` watches the
 * spectrum for onsets and returns the band that hit, and each band maps
 * to three properties of a drop:
 *
 * - **where** it lands — bass at the centre, treble at the rim
 * - **how hard** — the band's level becomes the drop's `strength`
 * - **how tight its rings are** — the band's wavenumber, through
 *   `uDropK`, which is why a kick makes a broad slow swell and a cymbal a
 *   fine quick one. Without that per-drop wavenumber every drop would
 *   ring at the same spacing and only differ in size.
 *
 * Colour comes from the surface's **slope**, not its height: flat water
 * reads black and only the moving rings light up, which is what suits a
 * dark panel. The ramp is the same level scale as the other three
 * visualizers, so switching between them stays coherent.
 *
 * With no audio it drops on a timer, so the panel is never dead. Frozen
 * while paused and under `prefers-reduced-motion`.
 */

/**
 * Tuned faster and tighter than the blade background's slow swell
 * (`blade-water.ts`): a visualizer wants to keep up with a beat, not
 * breathe over ten seconds.
 */
const PARAMS: Record<string, number> = {
  uAmp: 0.15,
  // lambda = 2*pi/uK ~= 2.1 units, about an eighth of the visible depth.
  // At uK 4 it was 1.57 over a 25-unit-wide view: sixteen rings across
  // the frame, each ripple ~6% of the panel, which on a tile this size
  // reads as nothing happening.
  uK: 3,
  uSpeed: 7,
  uSigma0: 1.2,
  uSigmaGrowth: 0.5,
  uTau: 1.6,
  uViscosity: 0.004,
  uR0: 0.8,
  uJetB: 0.5,
  uJetS: 0.3,
  uJetTau: 0.1,
  uCraterC: 0.2,
  uCraterTau: 0.06,
  uHeightScale: 2,
  uQuiet: 0,
  uDispersion: 0,
};

/**
 * The sheet is sized to the view, not the other way round: 32 units
 * covers the camera's ~24 x 17 of visible ground with margin to spare,
 * and no more — a bigger plane at the same segment count just spends
 * resolution off-screen. At 256 segments that is 0.125 units each, or 17
 * per wavelength.
 */
const PLANE_SIZE = 32;
const PLANE_SEGMENTS = 256;
/**
 * How far from the centre the highest band lands. Kept inside the
 * visible ground on every side, so no band ever drops out of frame —
 * the treble bands are the ones at risk, since they sit furthest out.
 */
const DROP_SPREAD = 6.5;
/** Seconds between drops when nothing is playing. */
const IDLE_INTERVAL = 0.5;
/** Total spectrum energy below which we treat the input as silence. */
const SILENCE = 0.01;
/**
 * How many ripples can be in flight. The whole array, unlike the slow
 * surfaces that share this field — a ripple is visible for about two
 * seconds, so capacity divided by that life is the drop rate this can
 * sustain: roughly twenty a second at 48 slots.
 */
const CAPACITY = MAX_DROPS;
/** Below this remaining amplitude a slot's ripple is over and reusable. */
const SPENT = 0.03;
/**
 * A new drop may still take a live slot if it is this much louder than
 * what is in it — a kick should not be refused because a faded tick is
 * still nominally ringing.
 */
const LOUDER_WINS = 0.35;
/**
 * Minimum seconds between drops. Without it a single loud bar spends the
 * entire budget in a few frames and then has nothing left, which is the
 * same starvation as having too few slots.
 */
const MIN_GAP = 0.05;
/**
 * Each band keeps its own direction, spaced by the golden angle.
 *
 * The angle used to be random, which is most of why this read as
 * "drops falling at random": a band landed somewhere different every
 * time it hit, so there was nothing to connect a sound to a place. Fixed
 * directions make the mapping visible — the bass always near the centre,
 * a given band always the same way out — while still filling the disc
 * evenly rather than lining up in spokes.
 */
const GOLDEN_ANGLE = 2.39996;
/** A little scatter so repeated hits are not pixel-identical. */
const ANGLE_JITTER = 0.22;
/** Slope-to-colour gain; the one knob for "how hot does it look". */
const COLOR_GAIN = 3.2;

const FRAGMENT = /* glsl */ `
${WATER_FIELD_CHUNK}
${WATER_FRAGMENT_PRELUDE}

uniform vec3  uLightDir;
uniform float uColorGain;

varying vec3 vWorldPos;
varying vec2 vField;
varying float vHeight;

/** The same level scale the other three visualizers are silkscreened in. */
vec3 ramp(float t) {
  vec3 blue   = vec3(0.298, 0.780, 1.000);
  vec3 violet = vec3(0.706, 0.361, 1.000);
  vec3 amber  = vec3(1.000, 0.541, 0.239);
  vec3 red    = vec3(1.000, 0.231, 0.188);
  if (t < 0.42) return mix(blue, violet, t / 0.42);
  if (t < 0.72) return mix(violet, amber, (t - 0.42) / 0.30);
  return mix(amber, red, clamp((t - 0.72) / 0.28, 0.0, 1.0));
}

void main() {
  vec3 s = surface(vField);
  vec3 N = worldNormal(s);
  vec3 V = normalize(cameraPosition - vWorldPos);

  // Slope, not height. A ripple's crest and trough both carry energy,
  // and the still water between rings has to read black on this panel.
  float energy = clamp(length(s.yz) * uColorGain, 0.0, 1.0);
  vec3 base = ramp(energy);

  vec3 H = normalize(normalize(uLightDir) + V);
  float spec = pow(max(dot(N, H), 0.0), 60.0);
  float fres = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 4.0);

  gl_FragColor = vec4(base * energy * (0.45 + 0.9 * fres) + spec * 0.7, 1.0);
}
`;

export function WaterVisualizer({
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
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch {
      return; // No WebGL2; the tile stays black rather than breaking.
    }
    renderer.setClearColor(0x07060c, 1);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const drops = Array.from({ length: MAX_DROPS }, () => new THREE.Vector4(0, 0, -1e6, 0));
    const dropK = flatDropK();
    let count = 0;
    let lastDropAt = -1;

    /**
     * Finds a slot for a new drop, or -1 to refuse it.
     *
     * Deliberately not a ring buffer. A ring recycles the oldest slot
     * whether or not its ripple has finished, so in a busy passage every
     * wave was cut a tenth of a second after it started and the whole
     * thing read as the animation being chopped rather than decaying.
     * This takes an unused or faded slot, and when everything is still
     * ringing it would rather **miss a hit** than truncate a visible
     * wave — a dropped onset is invisible, a cut wave is not.
     */
    const allocate = (t: number, strength: number) => {
      let quietestSlot = -1;
      let quietest = Infinity;
      for (let slot = 0; slot < CAPACITY; slot++) {
        const drop = drops[slot];
        if (drop.w <= 0) return slot;
        const remaining = drop.w * Math.exp(-(t - drop.z) / PARAMS.uTau);
        if (remaining < SPENT) return slot;
        if (remaining < quietest) {
          quietest = remaining;
          quietestSlot = slot;
        }
      }
      return quietest < strength * LOUDER_WINS ? quietestSlot : -1;
    };

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uDropCount: { value: 0 },
      uDrops: { value: drops },
      uDropK: { value: dropK },
      uLift: { value: 0 },
      uAlpha: { value: 1 },
      uLightDir: { value: new THREE.Vector3(0.3, 1, 0.2) },
      uColorGain: { value: COLOR_GAIN },
      ...Object.fromEntries(Object.entries(PARAMS).map(([k, v]) => [k, { value: v }])),
    };

    const geometry = new THREE.PlaneGeometry(
      PLANE_SIZE,
      PLANE_SIZE,
      PLANE_SEGMENTS,
      PLANE_SEGMENTS,
    );
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: FRAGMENT,
    });
    const mesh = new THREE.Mesh(geometry, material);
    // The jet lifts vertices off the plane the bounding sphere was
    // measured from, so let the GPU decide what is on screen.
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);

    // Steep, nearly overhead. The earlier three-quarter view spread the
    // drops over 30 units of foreshortened depth, so the far half of the
    // spectrum was squashed into a few pixels at the top of the tile.
    // Looking down keeps the rings close to circular, fills the panel,
    // and makes "bass in the middle" something you can actually see.
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.set(0, 20, 7);
    camera.lookAt(0, 0, 0);

    const detect = createOnsetDetector(VISUALIZER_BANDS);
    const origin = performance.now();
    let nextIdle = 0.2;
    let frame = 0;
    let frozenAt = -1;

    const addDrop = (band: number, strength: number, at: number) => {
      if (at - lastDropAt < MIN_GAP) return;
      const slot = allocate(at, strength);
      if (slot < 0) return;

      const radius = bandRadius(band, VISUALIZER_BANDS) * DROP_SPREAD;
      const angle = band * GOLDEN_ANGLE + (Math.random() - 0.5) * ANGLE_JITTER;
      drops[slot].set(Math.cos(angle) * radius, Math.sin(angle) * radius, at, strength);
      // Mutated in place: replacing the array would break three's binding.
      dropK[slot] = bandWavenumber(band, VISUALIZER_BANDS);
      // A high-water mark, which is what the shader's loop bound wants.
      count = Math.max(count, slot + 1);
      uniforms.uDropCount.value = count;
      lastDropAt = at;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // updateStyle off: the canvas is sized by its classes.
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const tick = (now: number) => {
      const still = motion.matches || pausedRef.current;
      if (still && frozenAt < 0) frozenAt = now;
      if (!still) frozenAt = -1;
      const t = ((still ? frozenAt : now) - origin) / 1000;
      uniforms.uTime.value = t;

      if (!still) {
        const source = spectrumRef.current;
        let energy = 0;
        if (source && source.length >= VISUALIZER_BANDS) {
          for (let band = 0; band < VISUALIZER_BANDS; band++) energy += source[band];
          for (const hit of detect(source, now)) addDrop(hit.band, hit.strength, t);
        }

        // The idle drop is for when there is no audio at all — not for a
        // frame without an onset. Onsets are sparse by nature, a handful
        // a second, so keying this on "nothing landed this frame" sprayed
        // random drops right through every song and buried the real ones.
        if (energy <= VISUALIZER_BANDS * SILENCE && t >= nextIdle) {
          addDrop(Math.floor(Math.random() * VISUALIZER_BANDS), 0.6, t);
          nextIdle = t + IDLE_INTERVAL + Math.random() * IDLE_INTERVAL;
        }
      }

      renderer.render(scene, camera);
      if (still) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame) return;
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
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // `tick` stops the loop when paused, so resuming has to start it again.
  useEffect(() => {
    if (!paused) startRef.current?.();
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block h-full w-full bg-[#07060c] ${className ?? ""}`}
    />
  );
}
