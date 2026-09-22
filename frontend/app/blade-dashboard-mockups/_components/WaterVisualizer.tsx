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
 * The water visualizer (DESIGN.md §6.16): the same WebGL wave field
 * that the blade background uses (§3.1), with the music as the source
 * of the drops.
 *
 * There is no new physics here. `ripplePacket` in
 * `app/_water/water-field.ts` is already a damped radial sinusoid under
 * a Gaussian envelope, which is the shape that a drop makes. This file
 * decides only when and where a drop lands. `audio-drops.ts` watches
 * the spectrum for an onset and returns the band that hit. Each band
 * sets three properties of a drop:
 *
 * - Where it lands: the bass at the centre and the treble at the rim.
 * - How hard: the level of the band becomes the `strength` of the drop.
 * - How tight its rings are: the wavenumber of the band, through
 *   `uDropK`. Thus a kick makes a broad slow swell and a cymbal makes a
 *   fine quick one. Without a wavenumber for each drop, all the drops
 *   would ring at the same spacing and only the size would change.
 *
 * The colour comes from the slope of the surface and not from its
 * height. Thus flat water is black and only the moving rings are lit,
 * which is correct for a dark panel. The ramp is the same level scale
 * as the other visualizers, thus a change of style stays coherent.
 *
 * With no audio the code drops on a timer, thus the panel is never
 * dead. The picture freezes during a pause and under
 * `prefers-reduced-motion`.
 */

/**
 * Tuned faster and tighter than the slow swell of the blade background
 * (`blade-water.ts`). A visualizer must follow a beat and must not
 * breathe across ten seconds.
 */
const PARAMS: Record<string, number> = {
  uAmp: 0.15,
  // lambda = 2*pi/uK, which is near 2.1 units, or an eighth of the
  // visible depth. At uK 4 it was 1.57 over a view 25 units wide: 16
  // rings across the frame and each ripple near 6% of the panel. On a
  // tile of this size that looks like nothing happens.
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
 * The size of the sheet comes from the view. 32 units covers the visible
 * ground of the camera, which is near 24 x 17, with a margin, and no
 * more. A larger plane at the same segment count uses its resolution
 * off the screen. At 256 segments a segment is 0.125 units, which is 17
 * segments for each wavelength.
 */
const PLANE_SIZE = 32;
const PLANE_SEGMENTS = 256;
/**
 * The distance from the centre where the highest band lands. It stays
 * inside the visible ground on each side, thus no band lands out of the
 * frame. The treble bands have the risk, because they are the furthest
 * out.
 */
const DROP_SPREAD = 6.5;
/** Seconds between two drops while nothing plays. */
const IDLE_INTERVAL = 0.5;
/** Below this total spectrum energy the code treats the input as silence. */
const SILENCE = 0.01;
/**
 * The number of ripples that can be in flight. This visualizer uses the
 * full array, and the slow surfaces that share this field do not. A
 * ripple is visible for near two seconds, thus the capacity divided by
 * that life is the drop rate: near 20 a second with 48 slots.
 */
const CAPACITY = MAX_DROPS;
/** Below this amplitude the ripple of a slot is complete and the slot is free. */
const SPENT = 0.03;
/**
 * A new drop can take a live slot when it is this much louder than the
 * ripple in that slot. A kick must not be refused because a faded tick
 * still rings.
 */
const LOUDER_WINS = 0.35;
/**
 * The minimum seconds between two drops. Without it one loud bar uses
 * the full budget in some frames and then has nothing left. That is the
 * same problem as too few slots.
 */
const MIN_GAP = 0.05;
/**
 * Each band keeps its own direction, spaced by the golden angle.
 *
 * The angle was random before, which is the main reason that the drops
 * looked random: a band landed at a different position at each hit,
 * thus nothing connected a sound to a place. A constant direction makes
 * the mapping visible. The bass is always near the centre and a given
 * band is always in the same direction. The golden angle also fills the
 * disc equally and does not form spokes.
 */
const GOLDEN_ANGLE = 2.39996;
/** A small scatter, thus two hits of one band are not at the same pixel. */
const ANGLE_JITTER = 0.22;
/** The gain from the slope to the colour. It is the one control of the brightness. */
const COLOR_GAIN = 3.2;

const FRAGMENT = /* glsl */ `
${WATER_FIELD_CHUNK}
${WATER_FRAGMENT_PRELUDE}

uniform vec3  uLightDir;
uniform float uColorGain;

varying vec3 vWorldPos;
varying vec2 vField;
varying float vHeight;

/** The same level scale as the other visualizers. */
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

  // The slope and not the height. The crest and the trough of a ripple
  // both carry energy, and the still water between two rings must be
  // black on this panel.
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
     * Finds a slot for a new drop, or returns -1 to refuse the drop.
     *
     * This is not a ring buffer. A ring reuses the oldest slot also
     * when its ripple is not complete. Thus in a busy passage each wave
     * was cut a tenth of a second after its start, and the animation
     * looked cut and not decayed. This function takes an unused slot or
     * a faded slot. When each slot still rings, it refuses the hit and
     * does not cut a visible wave: a refused onset is invisible and a
     * cut wave is not.
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
    // The jet moves vertices off the plane that gave the bounding
    // sphere. Thus let the GPU decide what is on the screen.
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);

    // A steep view, almost from above. The previous three-quarter view
    // spread the drops across 30 units of foreshortened depth, thus the
    // far half of the spectrum was some pixels at the top of the tile. A
    // view from above keeps the rings near circular, fills the panel and
    // makes the bass at the middle visible.
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
      // Mutated in place. A new array would break the binding of three.
      dropK[slot] = bandWavenumber(band, VISUALIZER_BANDS);
      // The maximum used index, which is the loop bound of the shader.
      count = Math.max(count, slot + 1);
      uniforms.uDropCount.value = count;
      lastDropAt = at;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // updateStyle is off: the classes of the canvas give its size.
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

        // The idle drop is for a state with no audio, and not for a
        // frame with no onset. Onsets are rare, some each second. A test
        // on "no drop at this frame" put random drops through each song
        // and hid the real drops.
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

  // `tick` stops the loop at a pause, thus a resume must start it again.
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
