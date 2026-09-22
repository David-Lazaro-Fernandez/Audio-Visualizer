"use client";

import { useEffect, useRef } from "react";
import type { TuningSpec } from "./TuningPanel";

/**
 * Walks a set of tuning knobs up and down on a slow tick.
 *
 * A **random walk with persistence**, not a random jump. Each knob keeps
 * a direction and mostly continues in it, flipping now and then and
 * always when it hits a bound. Re-rolling each value independently every
 * tick would read as jitter; keeping a direction reads as the thing
 * breathing, which is the point.
 *
 * Steps are a percentage of the knob's **own current value**, not of its
 * range. That is what keeps it calm across knobs of wildly different
 * scale: two percent of a curl strength of 3.5 and two percent of a curl
 * scale of 0.08 are both two percent, where a fixed fraction of the
 * range moved one of them imperceptibly and threw the other across its
 * whole span.
 *
 * Proportional stepping has one trap, and it is why `SOFTEN` exists: a
 * knob sitting at zero would multiply to a step of zero and never move
 * again. Adding a small slice of the range before scaling gives it
 * somewhere to push off from — the same trick as the `r0` term that
 * keeps `1/sqrt(r)` finite at the origin in the water field.
 *
 * Values are left **unsnapped**. Rounding each step to the slider's own
 * `step` was the main reason drift felt abrupt: at two percent a move is
 * often smaller than the step, so it quantised into a jump or into
 * nothing at all. The panel rounds for display; the scene gets the
 * continuous value.
 */

/** Fraction of the range added before scaling, so zero can still move. */
const SOFTEN = 0.05;
/** Chance per tick that a knob turns around on its own. */
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
  /** Fraction of a knob's own value it may move per tick. */
  percent?: number;
}) {
  /** Per-knob direction, kept across ticks so the walk has momentum. */
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
        // Mostly carry on; occasionally turn around.
        if (direction === undefined || Math.random() < TURN) {
          direction = Math.random() < 0.5 ? -1 : 1;
        }

        const range = spec.max - spec.min;
        const magnitude = Math.abs(current[key]) + range * SOFTEN;
        // Half to full of the nominal step, so ticks are not identical.
        const size = magnitude * percent * scale * (0.5 + Math.random() * 0.5);
        let next = current[key] + size * direction;

        // Bounce rather than stick: a knob pinned at its limit stops
        // contributing anything at all.
        if (next < spec.min || next > spec.max) {
          direction = -direction;
          next = current[key] + size * direction;
        }

        directions.current.set(key, direction);
        write(key, Math.max(spec.min, Math.min(spec.max, next)));
      }
    }, intervalMs);
    return () => clearInterval(timer);
    // `read`/`write` are stable module functions; specs and keys are const.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, percent]);
}
