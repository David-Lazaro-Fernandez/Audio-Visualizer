"use client";

import { useEffect, useRef } from "react";
import { VISUALIZER_BANDS, type VisualizerStyle } from "./visualizer-styles";

/**
 * The Music Player's visualizer (DESIGN.md §6.16), drawn as a hardware
 * **LED spectrum analyser**: a matrix of discrete cells lit from the
 * bottom of each column, the way a rack graphic EQ does it, rather than
 * continuous bars. It is deliberately the one surface not in the
 * section's palette — on the console it was a full-bleed graphic effect,
 * not chrome.
 *
 * Three things are what make it read as hardware rather than as a chart:
 *
 * - **Unlit cells stay visible.** A faint cool tint on every cell means
 *   you see the whole matrix at rest, so a quiet passage reads as a dim
 *   panel instead of an empty box.
 * - **Colour comes from the row, not the column.** Low cells are blue,
 *   the middle violet, the top amber and red — a level scale, so a loud
 *   band is red because it is *high*, not because of its frequency.
 * - **Peak hold.** Each column keeps its loudest recent cell lit and
 *   lets it sink slowly, which is the detached dot floating above the
 *   column on a real unit.
 *
 * Columns run left to right by frequency, bass at the left, as the
 * hardware does. This module draws three of the four styles the bumpers
 * cycle (`visualizer-styles.ts`): the matrix, mirrored bars — what the
 * console itself drew — and a radial ring. The fourth is WebGL and lives
 * in `WaterVisualizer.tsx`.
 *
 * The spectrum arrives as a `Float32Array` mutated in place by
 * `use-audio-spectrum.ts`, never as React state — it moves sixty times a
 * second. With no analyser feeding it, the signal is synthesised so the
 * panel is never a dead rectangle. Frozen while paused and under
 * `prefers-reduced-motion`, where it stops asking for frames entirely.
 */


/** Cells per column. */
const ROWS = 14;
/** Fraction of a cell's slot left as unlit gap, horizontally / vertically. */
const GAP_X = 0.22;
const GAP_Y = 0.26;

/** The level scale, bottom to top, as a real analyser is silkscreened. */
const RAMP: { upTo: number; lit: string; glow: string }[] = [
  { upTo: 0.42, lit: "#4cc7ff", glow: "rgba(76,199,255,.28)" },
  { upTo: 0.68, lit: "#b45cff", glow: "rgba(180,92,255,.28)" },
  { upTo: 0.87, lit: "#ff8a3d", glow: "rgba(255,138,61,.30)" },
  { upTo: 1.01, lit: "#ff3b30", glow: "rgba(255,59,48,.32)" },
];

/** Every cell carries this, so the grid is legible at rest. */
const UNLIT = "rgba(126,148,255,.075)";

/** How fast a held peak sinks, in rows per frame (~0.7 rows/second). */
const PEAK_FALL = 0.012;

function rampFor(rowFraction: number) {
  for (const step of RAMP) if (rowFraction <= step.upTo) return step;
  return RAMP[RAMP.length - 1];
}

/**
 * A plausible spectrum with no audio behind it: each band sums three
 * detuned sines, and lower bands are louder, the way real music is. The
 * result drifts rather than looping visibly.
 */
function syntheticSpectrum(time: number, out: Float32Array) {
  for (let i = 0; i < out.length; i++) {
    const band = i / out.length;
    const slope = Math.pow(1 - band, 1.6);
    const wobble =
      Math.sin(time * 1.7 + i * 0.55) * 0.5 +
      Math.sin(time * 2.9 - i * 0.31) * 0.3 +
      Math.sin(time * 5.3 + i * 1.07) * 0.2;
    out[i] = Math.max(0.04, slope * (0.55 + 0.45 * wobble));
  }
}

/**
 * The LED matrix: discrete cells lit from the bottom of each column, with
 * a held peak floating above it. `lighter` compositing plus a bloom that
 * spills just past each cell buys the panel's glow without an expensive
 * blur, and the gaps stay dark so it still reads as separate cells.
 */
function drawLed(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: Float32Array,
  peaks: Float32Array,
) {
  const slotW = width / VISUALIZER_BANDS;
  const slotH = height / ROWS;
  const cellW = Math.max(1, slotW * (1 - GAP_X));
  const cellH = Math.max(1, slotH * (1 - GAP_Y));
  const insetX = (slotW - cellW) / 2;
  const insetY = (slotH - cellH) / 2;
  const bloomX = insetX * 0.55;
  const bloomY = insetY * 0.55;

  // The unlit matrix, so the grid reads even in silence.
  context.globalCompositeOperation = "source-over";
  context.fillStyle = UNLIT;
  for (let column = 0; column < VISUALIZER_BANDS; column++) {
    const x = column * slotW + insetX;
    for (let row = 0; row < ROWS; row++) {
      context.fillRect(x, row * slotH + insetY, cellW, cellH);
    }
  }

  const cell = (x: number, row: number) => {
    const y = (ROWS - 1 - row) * slotH + insetY;
    const { lit, glow } = rampFor(row / (ROWS - 1));
    context.fillStyle = glow;
    context.fillRect(x - bloomX, y - bloomY, cellW + bloomX * 2, cellH + bloomY * 2);
    context.fillStyle = lit;
    context.fillRect(x, y, cellW, cellH);
  };

  context.globalCompositeOperation = "lighter";
  for (let column = 0; column < VISUALIZER_BANDS; column++) {
    const x = column * slotW + insetX;
    const litRows = Math.round(levels[column] * ROWS);
    for (let row = 0; row < litRows && row < ROWS; row++) cell(x, row);

    // The held peak, sitting on its own above the column.
    const peakRow = Math.min(ROWS - 1, Math.round(peaks[column] * ROWS) - 1);
    if (peakRow >= litRows && peakRow >= 0) cell(x, peakRow);
  }
  context.globalCompositeOperation = "source-over";
}

/**
 * Mirrored continuous bars, which is what the console's own visualizer
 * did: the spectrum drawn twice about the centre so the picture is
 * symmetric and the bass sits in the middle.
 */
function drawMirror(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: Float32Array,
) {
  const half = width / 2;
  const slot = half / VISUALIZER_BANDS;
  const barW = Math.max(1, slot * (1 - GAP_X));

  const gradient = context.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, RAMP[0].lit);
  gradient.addColorStop(0.55, RAMP[1].lit);
  gradient.addColorStop(0.85, RAMP[2].lit);
  gradient.addColorStop(1, RAMP[3].lit);

  context.globalCompositeOperation = "lighter";
  for (let band = 0; band < VISUALIZER_BANDS; band++) {
    const barH = Math.max(2, levels[band] * height * 0.92);
    const y = height - barH;
    const offset = band * slot;
    context.fillStyle = rampFor(levels[band]).glow;
    context.fillRect(half + offset - 2, y - 3, barW + 4, barH + 3);
    context.fillRect(half - offset - barW - 2, y - 3, barW + 4, barH + 3);
    context.fillStyle = gradient;
    context.fillRect(half + offset, y, barW, barH);
    context.fillRect(half - offset - barW, y, barW, barH);
  }
  context.globalCompositeOperation = "source-over";
}

/**
 * A radial ring: the spectrum wrapped around the centre and mirrored over
 * both halves, so it stays symmetric however the music moves. Spokes grow
 * outward from a fixed inner radius and take their colour from their own
 * level, not their angle.
 */
function drawRadial(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: Float32Array,
) {
  const cx = width / 2;
  const cy = height / 2;
  const inner = Math.min(width, height) * 0.16;
  const reach = Math.min(width, height) * 0.32;
  const spokes = VISUALIZER_BANDS * 2;

  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  const strokeWidth = Math.max(2, ((Math.PI * 2 * inner) / spokes) * 0.62);
  const glowWidth = strokeWidth * 2.2;

  for (let spoke = 0; spoke < spokes; spoke++) {
    // Second half counts back down, so the ring is symmetric: spoke 0
    // and the last spoke both show band 0.
    const band = spoke < VISUALIZER_BANDS ? spoke : spokes - 1 - spoke;
    const level = levels[band] ?? 0;
    // Start at the top and go clockwise, as a dial would.
    const angle = (spoke / spokes) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const outer = inner + Math.max(2, level * reach);
    const { lit, glow } = rampFor(level);

    context.strokeStyle = glow;
    context.lineWidth = glowWidth;
    context.beginPath();
    context.moveTo(cx + cos * inner, cy + sin * inner);
    context.lineTo(cx + cos * outer, cy + sin * outer);
    context.stroke();

    context.strokeStyle = lit;
    context.lineWidth = strokeWidth;
    context.beginPath();
    context.moveTo(cx + cos * inner, cy + sin * inner);
    context.lineTo(cx + cos * outer, cy + sin * outer);
    context.stroke();
  }
  context.globalCompositeOperation = "source-over";
}

export function MusicVisualizer({
  paused = false,
  amplitude = 1,
  spectrum,
  style = "led",
  className,
}: {
  paused?: boolean;
  /** Which of `VISUALIZER_STYLES` to draw. */
  style?: VisualizerStyle;
  /** Overall level, 0..1. Scales the whole spectrum. */
  amplitude?: number;
  /** Real spectrum, 0..1 per band. Omit to use the synthetic one. */
  spectrum?: Float32Array;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const amplitudeRef = useRef(amplitude);
  amplitudeRef.current = amplitude;
  const spectrumRef = useRef(spectrum);
  spectrumRef.current = spectrum;
  // Read inside the draw loop, so switching never rebuilds the canvas.
  const styleRef = useRef(style);
  styleRef.current = style;
  /** Set by the mount effect so unpausing can restart the loop. */
  const startRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bands = new Float32Array(VISUALIZER_BANDS);
    /** Smoothed so columns fall away rather than snapping between frames. */
    const levels = new Float32Array(VISUALIZER_BANDS);
    /** The held peak per column, in the same 0..1 scale. */
    const peaks = new Float32Array(VISUALIZER_BANDS);
    let frame = 0;
    let frozenAt = -1;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };

    const draw = (now: number) => {
      const { width, height } = canvas;
      if (!width) return;

      // Reduced motion and pause both hold the picture still, so the
      // spectrum is sampled once and then reused.
      const still = motion.matches || pausedRef.current;
      const time = still ? (frozenAt < 0 ? (frozenAt = now) : frozenAt) / 1000 : now / 1000;
      if (!still) frozenAt = -1;

      const source = spectrumRef.current;
      if (source && source.length >= VISUALIZER_BANDS) {
        for (let i = 0; i < VISUALIZER_BANDS; i++) bands[i] = source[i];
      } else {
        syntheticSpectrum(time, bands);
      }

      const gain = Math.max(0, Math.min(1, amplitudeRef.current));
      for (let i = 0; i < VISUALIZER_BANDS; i++) {
        const target = bands[i] * gain;
        // Rise fast, fall slow: the shape a level meter has.
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.55 : 0.12);
        peaks[i] = still
          ? Math.max(peaks[i], levels[i])
          : Math.max(levels[i], peaks[i] - PEAK_FALL);
      }

      context.clearRect(0, 0, width, height);
      // All three read the same levels; only the drawing differs.
      if (styleRef.current === "mirror") drawMirror(context, width, height, levels);
      else if (styleRef.current === "radial") drawRadial(context, width, height, levels);
      else drawLed(context, width, height, levels, peaks);
    };

    const tick = (now: number) => {
      draw(now);
      // A still picture needs no further frames; pausing or reducing
      // motion stops the loop until something changes.
      if (motion.matches || pausedRef.current) {
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
      draw(performance.now());
      start();
    });
    observer.observe(canvas);
    motion.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", start);
      startRef.current = null;
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
