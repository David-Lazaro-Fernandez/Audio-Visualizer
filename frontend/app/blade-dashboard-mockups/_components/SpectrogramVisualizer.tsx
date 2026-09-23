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
 * history of the spectrum.
 *
 * Each row is one snapshot of the 28 bands, drawn as one polyline with
 * a peak at each band that had energy. The code adds a new row at the
 * front at a constant rate, and each older row moves back. Thus the
 * display shows the time from the front to the back and the frequency
 * from the left to the right. A ridge that goes away from the viewer is
 * a note that holds, and one spike that moves back and becomes dim is a
 * hit that passed.
 *
 * The rows arrive at a constant rate, but they do not move at one:
 * between two pushes the whole stack glides back by the fraction of the
 * interval that has passed, and the push cancels that offset exactly.
 * A push moves every row one gap back at once, thus without the glide
 * the display steps fourteen times a second and looks like a renderer
 * at fourteen frames a second.
 *
 * The projection is orthographic and not perspective. The rows must
 * stay parallel. A perspective camera moves them together toward a
 * vanishing point, which makes the time axis a horizon and makes the
 * older rows unreadable where there are the most rows. A parallel
 * projection keeps each row at the same width, thus the age shows only
 * as a position and a brightness. It also lets the code measure the
 * frustum from the geometry and not from a camera distance: the code
 * transforms the eight corners of the box of the rows into camera
 * space, which gives the exact half-extents to frame and the offset of
 * the content from the centre.
 *
 * The lines are 1 px. WebGL ignores `linewidth` on almost each
 * platform, thus a real thickness would need the `Line2` addon and its
 * instanced geometry. Additive blending on a near-black panel replaces
 * the thickness: two rows that cross become brighter where they
 * overlap, which gives the display its density.
 *
 * Each value is adjustable at run time from `spectrogram-controls.ts`.
 * The scene subscribes to that store directly and does not take props,
 * thus a slider drag does not rebuild the renderer.
 */

/**
 * The distance from the camera to its target. The value is arbitrary:
 * the projection is orthographic, thus the distance changes nothing on
 * the screen. It must only stay inside the clip planes.
 */
const CAMERA_RADIUS = 40;
const DEG = Math.PI / 180;

/**
 * The level scale of the other visualizers, as numbers. Their copies
 * are a list of CSS strings and a GLSL constant, thus the three cannot
 * share one representation. Only the values are the same.
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

    /** The history as a ring. `head` is the position of the next row. */
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
    // The clip planes are far apart, because the row count and the row
    // spacing are both adjustable. At their maximums the rows are almost
    // 200 units deep.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 1000);
    const target = new THREE.Vector3();
    const corner = new THREE.Vector3();
    const inverse = new THREE.Matrix4();
    const worldUp = new THREE.Vector3();
    let fit = { halfWidth: 1, halfHeight: 1 };

    /**
     * Measures the size of the content on the axes of the camera.
     *
     * The code transforms the eight corners of the box of the rows into
     * camera space. That gives the exact half-width and half-height of
     * the frustum, and the y centre gives the offset of the view axis
     * from the middle of the content. A measurement is better than a
     * tuned number for two reasons: a fixed frustum used a quarter of
     * the panel as a margin, because the content was above the target,
     * and each change of a knob would need a new value.
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
     * Puts the camera at an azimuth and an elevation, then corrects its
     * direction.
     *
     * The steps are: point the camera, measure the offset of the content
     * from the centre, then point the camera again. One correction is
     * sufficient, and the frustum comes from the second measurement.
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
     * Writes the full buffer again from the ring.
     *
     * The depth and the brightness of each row depend on its age, and
     * each row becomes older when a new row arrives. Thus there is no
     * incremental update to make. At some thousands of vertices and 12
     * updates a second, an incremental update has no value.
     */
    const rebuild = () => {
      const { rows, spanX, peakY, rowGap, fade, brightness } = config;
      let v = 0;
      for (let age = 0; age < rows; age++) {
        const row = (((head - 1 - age) % rows) + rows) % rows;
        const base = row * VISUALIZER_BANDS;
        const z = -age * rowGap;
        // An older row becomes dim toward the background and does not
        // disappear. Thus the trail shows depth and not rows that stop.
        const dim = Math.pow(1 - age / rows, fade) * brightness;

        for (let band = 0; band < segments; band++) {
          for (let end = 0; end < 2; end++) {
            const at = band + end;
            const level = history[base + at];
            const i = v * 3;
            positions[i] = (at / (VISUALIZER_BANDS - 1) - 0.5) * spanX;
            positions[i + 1] = level * peakY;
            positions[i + 2] = z;
            // The colour comes from the level of the band, made dim by
            // the age of the row.
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
      // Fit the axis with the limit. A wide tile has a limit from the
      // height of the rows, and a narrow tile from their width. A fit to
      // the larger of the two keeps the frequency axis in the frame at
      // each shape of the panel.
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

      // The code adds a row at a constant rate and not at each frame.
      // Thus the display is a history at a known rate and its depth is a
      // known interval of time.
      const interval = Math.max(0.001, config.intervalMs / 1000);
      if (!still && t >= nextRow) {
        push();
        nextRow = t + interval;
      }

      // Then glide the whole stack back by the part of the interval that
      // has passed.
      //
      // A row is discrete, but the motion must not be. Each push moves
      // every row back one gap, thus without this the full image jumps
      // fourteen times a second and reads as fourteen frames a second,
      // whatever the renderer does. The offset and the push cancel
      // exactly: at the push a row becomes one age older, which is one
      // gap back, and the offset returns to zero at the same moment.
      //
      // The alternative was a row for each frame, which is what the
      // point landscape of the Grid does (§6.16). It is wrong here. The
      // depth of this display is an interval of time that a knob sets,
      // and `rebuild` writes every vertex of every row at each push,
      // thus a rate of 60 would cost twelve times more and take the
      // meaning out of the knob. One assignment a frame buys the same
      // smoothness and keeps both.
      const frac = Math.min(1, Math.max(0, 1 - (nextRow - t) / interval));
      lines.position.z = -frac * config.rowGap;

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
