"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { VISUALIZER_BANDS } from "./visualizer-styles";
import {
  spectrogramState,
  subscribeSpectrogram,
  type SpectrogramState,
} from "./spectrogram-controls";

/**
 * The spectrogram visualizer (DESIGN.md §6.16): a waterfall of the
 * spectrum's own history.
 *
 * Every row is one snapshot of the 28 bands, drawn as a single polyline
 * with a peak wherever a band had energy. A new row is laid down at the
 * front on a fixed beat and every older one steps back, so the display
 * reads front-to-back as *time* and left-to-right as *frequency* — a
 * ridge running away from you is a note holding, and a lone spike that
 * recedes and dims is a hit that has passed.
 *
 * **Orthographic, not perspective.** The rows have to stay parallel. A
 * perspective camera converges them toward a vanishing point, which
 * turns a time axis into a horizon and makes the older rows unreadable
 * exactly when there are most of them; a parallel projection keeps every
 * row the same width, so age reads purely as position and brightness.
 * It also makes the frustum measurable from the geometry instead of a
 * camera-distance puzzle: the eight corners of the box the rows live in
 * are transformed into camera space, which gives the exact half-extents
 * to frame and how far off centre the content sits.
 *
 * Lines are 1 px: WebGL ignores `linewidth` on essentially every
 * platform, so real thickness would mean the `Line2` addon and its
 * instanced geometry. Additive blending on a near-black panel carries it
 * instead — crossing rows brighten where they overlap, which is what
 * gives the tangle its density.
 *
 * Everything is live-adjustable from `spectrogram-controls.ts`. The
 * scene subscribes to that store directly rather than taking props, so
 * dragging a slider never rebuilds the renderer.
 */

/**
 * Distance the camera sits from what it looks at. Arbitrary: the
 * projection is orthographic, so this changes nothing you can see, and
 * only has to stay inside the clip planes.
 */
const CAMERA_RADIUS = 40;
const DEG = Math.PI / 180;

/**
 * The level scale the other visualizers are coloured by, as numbers.
 * Their copies are a CSS string list and a GLSL constant respectively,
 * so the three cannot share one representation; the values are what
 * match.
 */
const RAMP: [number, number, number][] = [
  [0.298, 0.78, 1.0], // blue
  [0.706, 0.361, 1.0], // violet
  [1.0, 0.541, 0.239], // amber
  [1.0, 0.231, 0.188], // red
];

function levelColor(level: number, out: [number, number, number]) {
  const t = Math.max(0, Math.min(1, level)) * (RAMP.length - 1);
  const low = Math.floor(t);
  const high = Math.min(RAMP.length - 1, low + 1);
  const k = t - low;
  for (let i = 0; i < 3; i++) out[i] = RAMP[low][i] + (RAMP[high][i] - RAMP[low][i]) * k;
}

export function SpectrogramVisualizer({
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
    const segments = VISUALIZER_BANDS - 1;
    let config: SpectrogramState = { ...spectrogramState() };

    // --- geometry, resized when the row count changes ---------------------
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(lines);

    /** History as a ring: `head` is where the next row will be written. */
    let history = new Float32Array(0);
    let positions = new Float32Array(0);
    let colors = new Float32Array(0);
    let head = 0;

    const allocate = (rows: number) => {
      history = new Float32Array(rows * VISUALIZER_BANDS);
      head = 0;
      const vertices = rows * segments * 2;
      positions = new Float32Array(vertices * 3);
      colors = new Float32Array(vertices * 3);
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    };

    // --- camera ----------------------------------------------------------
    // Clip planes are generous because the row count and spacing are both
    // adjustable: at their limits the rows run nearly 200 units deep.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 1000);
    const target = new THREE.Vector3();
    const corner = new THREE.Vector3();
    const inverse = new THREE.Matrix4();
    const worldUp = new THREE.Vector3();
    let fit = { halfWidth: 1, halfHeight: 1 };

    /**
     * Measures the content's footprint on the camera's own axes.
     *
     * Transforming the eight corners of the box the rows live in into
     * camera space gives exactly the half-width and half-height the
     * frustum needs, and the y centre says how far the view axis misses
     * the content's middle. Measuring beats a hand-tuned number twice
     * over: a fixed frustum wasted a quarter of the panel on margin
     * because the content sat well above the target, and it would have
     * to be re-tuned every time a knob moved.
     */
    const measure = () => {
      camera.updateMatrixWorld();
      inverse.copy(camera.matrixWorld).invert();
      let halfWidth = 0;
      let top = -Infinity;
      let bottom = Infinity;
      const depth = config.rows * config.rowGap;
      for (const x of [-config.spanX / 2, config.spanX / 2]) {
        for (const y of [0, config.peakY]) {
          for (const z of [-depth, 0]) {
            corner.set(x, y, z).applyMatrix4(inverse);
            halfWidth = Math.max(halfWidth, Math.abs(corner.x));
            top = Math.max(top, corner.y);
            bottom = Math.min(bottom, corner.y);
          }
        }
      }
      return { halfWidth, halfHeight: (top - bottom) / 2, offset: (top + bottom) / 2 };
    };

    /**
     * Places the camera from azimuth and elevation, then corrects its aim.
     *
     * Aim, measure how far off centre the content sits, aim again. One
     * correction is enough, and the second measurement is what the
     * frustum is built from.
     */
    const aim = () => {
      const az = config.azimuth * DEG;
      const el = config.elevation * DEG;
      const base = new THREE.Vector3(
        0,
        config.peakY * 0.3,
        -config.rows * config.rowGap * 0.45,
      );
      camera.position.set(
        base.x - CAMERA_RADIUS * Math.sin(az) * Math.cos(el),
        base.y + CAMERA_RADIUS * Math.sin(el),
        base.z + CAMERA_RADIUS * Math.cos(az) * Math.cos(el),
      );
      target.copy(base);
      camera.lookAt(target);
      worldUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      target.addScaledVector(worldUp, measure().offset);
      camera.lookAt(target);
      fit = measure();
    };

    // --- drawing ---------------------------------------------------------
    const tint: [number, number, number] = [0, 0, 0];

    /**
     * Rewrites the whole buffer from the ring.
     *
     * Every row's depth and brightness depend on its *age*, and every row
     * ages when a new one arrives, so there is nothing to update
     * incrementally — and at a few thousand vertices a dozen times a
     * second there is no reason to try.
     */
    const rebuild = () => {
      const { rows, spanX, peakY, rowGap, fade, brightness } = config;
      let v = 0;
      for (let age = 0; age < rows; age++) {
        const row = (((head - 1 - age) % rows) + rows) % rows;
        const base = row * VISUALIZER_BANDS;
        const z = -age * rowGap;
        // Older rows dim toward the background rather than vanishing, so
        // the trail reads as depth and not as rows switching off.
        const dim = Math.pow(1 - age / rows, fade) * brightness;

        for (let band = 0; band < segments; band++) {
          for (let end = 0; end < 2; end++) {
            const at = band + end;
            const level = history[base + at];
            const i = v * 3;
            positions[i] = (at / (VISUALIZER_BANDS - 1) - 0.5) * spanX;
            positions[i + 1] = level * peakY;
            positions[i + 2] = z;
            // Colour by the band's own level, dimmed by the row's age.
            levelColor(level, tint);
            colors[i] = tint[0] * dim;
            colors[i + 1] = tint[1] * dim;
            colors[i + 2] = tint[2] * dim;
            v++;
          }
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    };

    const push = () => {
      const source = spectrumRef.current;
      const base = head * VISUALIZER_BANDS;
      for (let band = 0; band < VISUALIZER_BANDS; band++) {
        history[base + band] = source?.[band] ?? 0;
      }
      head = (head + 1) % config.rows;
      rebuild();
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      // Fit to whichever axis binds. A wide tile is limited by the rows'
      // height, a narrow one by their width, and fitting the larger of
      // the two means the frequency axis never runs off the sides
      // whatever shape the panel is.
      const aspect = width / height;
      const margin = 1 + config.marginPct / 100;
      const half = Math.max(fit.halfHeight, fit.halfWidth / aspect) * margin;
      camera.top = half;
      camera.bottom = -half;
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.updateProjectionMatrix();
    };

    const apply = (next: SpectrogramState) => {
      const resized = next.rows !== config.rows;
      config = { ...next };
      if (resized) allocate(config.rows);
      aim();
      resize();
      rebuild();
    };

    allocate(config.rows);
    aim();
    resize();
    rebuild();
    const unsubscribe = subscribeSpectrogram(apply);

    // --- loop ------------------------------------------------------------
    const origin = performance.now();
    let nextRow = 0;
    let frame = 0;
    let frozenAt = -1;

    const tick = (now: number) => {
      const still = motion.matches || pausedRef.current;
      if (still && frozenAt < 0) frozenAt = now;
      if (!still) frozenAt = -1;
      const t = ((still ? frozenAt : now) - origin) / 1000;

      // Rows are laid down on a beat, not per frame: the display is a
      // history at a known rate, so its depth is a known span of time.
      if (!still && t >= nextRow) {
        push();
        nextRow = t + config.intervalMs / 1000;
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
    start();

    const observer = new ResizeObserver(() => {
      resize();
      start();
    });
    observer.observe(canvas);
    motion.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
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
