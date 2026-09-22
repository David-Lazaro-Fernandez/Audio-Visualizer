"use client";

import { useEffect, useRef } from "react";
import type { TuningSpec } from "./TuningPanel";

/**
 * Moves a set of tuning knobs up and down on a slow tick.
 *
 * The walk is a random walk with persistence, not a random jump. Each
 * knob keeps a direction and usually continues in it. It turns
 * occasionally, and always at a bound. A new independent value at each
 * tick looks like jitter. A kept direction looks like the scene
 * breathing, which is the aim.
 *
 * A step is a percentage of the current value of the knob, not of its
 * range. This keeps the walk calm across knobs with very different
 * scales: two percent of a curl strength of 3.5 and two percent of a
 * curl scale of 0.08 are both two percent. A constant fraction of the
 * range moved the first knob too little and the second knob across its
 * full span.
 *
 * A proportional step has one problem, and `SOFTEN` corrects it: a knob
 * at zero multiplies to a step of zero and then cannot move. A small
 * part of the range added before the scaling gives the knob a start.
 * This is the same method as the `r0` term that keeps `1/sqrt(r)` finite
 * at the origin in the water field.
 *
 * The values are not snapped. A step rounded to the `step` of the slider
 * was the primary cause of abrupt drift: at two percent a move is
 * frequently smaller than the step, thus it became a jump or nothing.
 * The panel rounds for the display, and the scene gets the continuous
 * value.
 */

/** Fraction of the range added before the scaling, thus zero can move. */
const SOFTEN = 0.05;
/** Probability at each tick that a knob turns without a bound. */
const TURN = 0.25;

export function useDrift<K extends string>({
  enabled,
  keys,
  specs,
  read,
  write,
  intervalMs = 250,
  percent = 0.02,
}: {
  enabled: boolean;
  keys: readonly K[];
  specs: Record<K, TuningSpec>;
  read: () => Readonly<Record<K, number>>;
  write: (key: K, value: number) => void;
  intervalMs?: number;
  /** Fraction of its own value that a knob can move at each tick. */
  percent?: number;
}) {
  /** Direction of each knob, kept across ticks to give the walk momentum. */
  const directions = useRef(new Map<K, number>());

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const current = read();
      for (const key of keys) {
        const spec = specs[key];
        const scale = spec.driftScale ?? 1;
        if (scale <= 0) continue;

        let direction = directions.current.get(key);
        // Usually continue. Turn occasionally.
        if (direction === undefined || Math.random() < TURN) {
          direction = Math.random() < 0.5 ? -1 : 1;
        }

        const range = spec.max - spec.min;
        const magnitude = Math.abs(current[key]) + range * SOFTEN;
        // Half to all of the nominal step, thus the ticks are not equal.
        const size = magnitude * percent * scale * (0.5 + Math.random() * 0.5);
        let next = current[key] + size * direction;

        // Bounce and do not stop. A knob held at its limit adds nothing.
        if (next < spec.min || next > spec.max) {
          direction = -direction;
          next = current[key] + size * direction;
        }

        directions.current.set(key, direction);
        write(key, Math.max(spec.min, Math.min(spec.max, next)));
      }
    }, intervalMs);
    return () => clearInterval(timer);
    // `read` and `write` are stable module functions. `specs` and `keys`
    // are constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, percent]);
}
