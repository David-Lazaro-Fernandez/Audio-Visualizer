"use client";

import { useEffect } from "react";
import { createOnsetDetector } from "./audio-drops";
import { beatBandWeight, pushBeatOnset } from "./beat-clock";

/**
 * Feeds the beat clock (DESIGN.md §6.16) from the live spectrum that the
 * Music Player has.
 *
 * It is a hook beside `use-blade-pulse.ts` and not some lines in the
 * player, for the same reason: the clock must run with or without a
 * visualizer that reads it, and it must keep running while a style that
 * ignores it is on the screen. A tempo needs several seconds of
 * evidence, thus a clock that starts when a reader mounts would give
 * that reader nothing for its first bars.
 *
 * The detector is this hook's own and is `adaptive`, thus its gate
 * follows the density of the track. The visible drops of
 * `WaterVisualizer.tsx` keep the fixed gate: there the threshold is
 * part of a tuned picture, and here it only has to produce a usable
 * number of events on any music.
 */
export function useBeatClock(spectrum: Float32Array, active = true) {
  useEffect(() => {
    if (!active) return;
    const bands = spectrum.length;
    const detect = createOnsetDetector(bands, { adaptive: true });
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const hits = detect(spectrum, now);
      if (!hits.length) return;

      // One event for each frame, and not one for each band. A snare
      // lights a dozen bands at one instant, and a dozen events there
      // would tell the transform that the music has a dozen beats at
      // that time. The strongest hit of the frame, weighted down toward
      // the treble, stands for the moment.
      let strength = 0;
      for (const hit of hits) {
        strength = Math.max(strength, hit.strength * beatBandWeight(hit.band, bands));
      }
      pushBeatOnset(strength, now);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spectrum, active]);
}
