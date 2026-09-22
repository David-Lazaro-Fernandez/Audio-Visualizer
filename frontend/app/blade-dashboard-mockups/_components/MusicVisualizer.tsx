"use client";

import { useEffect, useRef } from "react";
import { VISUALIZER_BANDS, type VisualizerStyle } from "./visualizer-styles";

/**
 * The visualizer of the Music Player (DESIGN.md §6.16), drawn as a
 * hardware LED spectrum analyser: a matrix of discrete cells lit from
 * the bottom of each column, as a rack graphic EQ does it, and not as
 * continuous bars. It is the one surface that does not use the palette
 * of the section. On the console it was a full-bleed graphic effect and
 * not chrome.
 *
 * Three details make it look like hardware and not like a chart:
 *
 * - An unlit cell stays visible. Each cell has a faint cool tint, thus
 *   the full matrix is visible at rest and a quiet passage is a dim
 *   panel and not an empty box.
 * - The colour comes from the row and not from the column. A low cell
 *   is blue, a middle cell is violet, and a top cell is amber or red.
 *   This is a level scale, thus a loud band is red because it is high
 *   and not because of its frequency.
 * - The peak holds. Each column keeps its loudest recent cell lit and
 *   lets it fall slowly. This is the separate dot above a column on a
 *   real unit.
 *
 * The columns run left to right by frequency, with the bass at the
 * left, as the hardware does. This module draws three of the styles
 * that the bumpers cycle (`visualizer-styles.ts`): the matrix, the
 * mirrored bars, which is what the console drew, and a radial ring. The
 * other styles use WebGL and are in their own files.
 *
 * The spectrum arrives as a `Float32Array` that
 * `use-audio-spectrum.ts` mutates in place, and never as React state,
 * because it changes 60 times a second. With no analyser, the code
 * synthesises the signal, thus the panel is never a dead rectangle. The
 * picture freezes during a pause and under `prefers-reduced-motion`,
 * where the loop also stops its request for frames.
 */


/** The number of cells in a column. */
const ROWS = 14;
/** The fraction of the slot of a cell that stays an unlit gap, horizontally and vertically. */
const GAP_X = 0.22;
const GAP_Y = 0.26;

/** The level scale, bottom to top, as the print on a real analyser. */
const RAMP: { upTo: number; lit: string; glow: string }[] = [
  { upTo: 0.42, lit: "#4cc7ff", glow: "rgba(76,199,255,.28)" },
  { upTo: 0.68, lit: "#b45cff", glow: "rgba(180,92,255,.28)" },
  { upTo: 0.87, lit: "#ff8a3d", glow: "rgba(255,138,61,.30)" },
  { upTo: 1.01, lit: "#ff3b30", glow: "rgba(255,59,48,.32)" },
];

/** Each cell has this tint, thus the grid is readable at rest. */
const UNLIT = "rgba(126,148,255,.075)";

/** How fast a held peak falls, in rows for each frame, which is near 0.7 rows a second. */
const PEAK_FALL = 0.012;

function rampFor(rowFraction: number) {
  for (const step of RAMP) if (rowFraction <= step.upTo) return step;
  return RAMP[RAMP.length - 1];
}

/**
 * A realistic spectrum with no audio. Each band is the sum of three
 * detuned sines, and a low band is louder, as in real music. The result
 * drifts and has no visible loop.
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
 * The LED matrix: discrete cells lit from the bottom of each column,
 * with a held peak above them. The `lighter` composite and a bloom that
 * goes a short distance past each cell give the glow of the panel with
 * no expensive blur. The gaps stay dark, thus the cells stay separate.
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

  // The unlit matrix, thus the grid is visible also in silence.
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

    // The held peak, alone above the column.
    const peakRow = Math.min(ROWS - 1, Math.round(peaks[column] * ROWS) - 1);
    if (peakRow >= litRows && peakRow >= 0) cell(x, peakRow);
  }
  context.globalCompositeOperation = "source-over";
}

/**
 * Mirrored continuous bars, as the visualizer of the console drew them:
 * the spectrum drawn two times about the centre, thus the picture is
 * symmetric and the bass is at the middle.
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
 * A radial ring: the spectrum around the centre, mirrored on the two
 * halves, thus it stays symmetric at each change of the music. A spoke
 * grows outward from a constant inner radius and takes its colour from
 * its own level and not from its angle.
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
    // The second half counts back down, thus the ring is symmetric:
    // spoke 0 and the last spoke both show band 0.
    const band = spoke < VISUALIZER_BANDS ? spoke : spokes - 1 - spoke;
    const level = levels[band] ?? 0;
    // Start at the top and continue clockwise, as a dial does.
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
  /** The style from `VISUALIZER_STYLES` to draw. */
  style?: VisualizerStyle;
  /** The total level, 0..1. It scales the full spectrum. */
  amplitude?: number;
  /** The real spectrum, 0..1 for each band. With no value the code uses the synthetic spectrum. */
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
  // The draw loop reads this, thus a change of style does not rebuild
  // the canvas.
  const styleRef = useRef(style);
  styleRef.current = style;
  /** The mount effect sets it, thus the end of a pause can start the loop again. */
  const startRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bands = new Float32Array(VISUALIZER_BANDS);
    /** Smoothed, thus a column falls slowly and does not jump between frames. */
    const levels = new Float32Array(VISUALIZER_BANDS);
    /** The held peak of each column, in the same 0..1 scale. */
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

      // Reduced motion and a pause both hold the picture. Thus the code
      // samples the spectrum one time and then uses that sample again.
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
        // Rise fast and fall slow, as a level meter does.
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.55 : 0.12);
        peaks[i] = still
          ? Math.max(peaks[i], levels[i])
          : Math.max(levels[i], peaks[i] - PEAK_FALL);
      }

      context.clearRect(0, 0, width, height);
      // All three styles read the same levels. Only the drawing is different.
      if (styleRef.current === "mirror") drawMirror(context, width, height, levels);
      else if (styleRef.current === "radial") drawRadial(context, width, height, levels);
      else drawLed(context, width, height, levels, peaks);
    };

    const tick = (now: number) => {
      draw(now);
      // A still picture needs no more frames. A pause or reduced motion
      // stops the loop until a value changes.
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
