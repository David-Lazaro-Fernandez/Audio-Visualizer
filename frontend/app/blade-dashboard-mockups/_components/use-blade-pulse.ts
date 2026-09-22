"use client";

import { useEffect } from "react";
import { pushBladePulse } from "./blade-pulse";
import { bandHzRange } from "./use-audio-spectrum";

/**
 * Drives the bass pulse of the blade surface (DESIGN.md §6.16) from the
 * live spectrum that the Music Player has.
 *
 * This is a hook and not some lines in the player, because the loop must
 * run with or without a visualizer. The background follows the music
 * also on a style that draws almost nothing, and it must continue while
 * the player is on the screen.
 *
 * The hook reads the same `Float32Array` that the analyser mutates in
 * place and writes to a module-level store (`blade-pulse.ts`). Thus
 * nothing here renders a component 60 times a second.
 */

/**
 * The top of the bass. Below near 180 Hz are the kick, the bass line and
 * the low part of most of the rhythm. This is what a listener feels,
 * thus this is what the background must answer.
 */
const BASS_MAX_HZ = 180;

/** The number of log-spaced bands (§6.16) below `BASS_MAX_HZ`. */
export function bassBandCount(bands: number): number {
  let count = 0;
  while (count < bands && bandHzRange(count, bands)[0] < BASS_MAX_HZ) count++;
  return Math.max(1, count);
}

export function useBladePulse(spectrum: Float32Array, active = true) {
  useEffect(() => {
    if (!active) return;
    const top = bassBandCount(spectrum.length);
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // The loudest bass band, not their mean. A kick is in one or two
      // bands, and the bands below 40 Hz are usually empty in a store
      // preview. Thus a mean of the eight bands adds silence to each
      // hit.
      let bass = 0;
      for (let band = 0; band < top; band++) {
        bass = Math.max(bass, spectrum[band] ?? 0);
      }
      pushBladePulse(bass, now);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spectrum, active]);
}
