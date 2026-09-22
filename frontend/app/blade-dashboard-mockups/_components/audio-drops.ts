"use client";

/**
 * Makes water-drop events from a live spectrum (DESIGN.md §6.16).
 *
 * Each drop in the wave field is already a damped radial sinusoid
 * (`ripplePacket` in `app/_water/water-field.ts`). Thus the music is not
 * a physics problem here. It is a trigger problem: when does a drop
 * land.
 *
 * The trigger must use onsets and not levels. A drop is a transient,
 * such as a kick, a snare or a plucked string. Thus the test is whether
 * a band went above its recent value, against a rolling mean for each
 * band. A simple level threshold would fire at each frame while a band
 * is loud, which is 60 drops a second. The ring buffer of 16 slots would
 * then recycle before one ripple travelled.
 *
 * That ring buffer is the limited resource, thus there are two guards:
 *
 * - The cooldown increases with the frequency. Cymbals and hi-hats fire
 *   almost continuously. Without a cooldown they would write over the
 *   bass swell before it spread. A low band can fire again after 90 ms,
 *   and the top band after almost half a second.
 * - A frame can start a maximum of two drops, and the strongest first. A
 *   snare hit raises a dozen bands at one time, and all of them would
 *   land together and empty the buffer.
 */

/** A band with a new onset, and its strength. */
export interface DropEvent {
  band: number;
  /** 0..1. It becomes the `strength` of the drop. */
  strength: number;
}

/** How fast the rolling mean follows the signal: near 0.3 s at 60 fps. */
const MEAN_RATE = 0.05;
/** A band must be above its mean by this factor to be an onset. */
const ONSET_RATIO = 1.6;
/** A band must also be this loud, thus noise in silence does not trigger a drop. */
const ONSET_FLOOR = 0.1;
/** The cooldown before a new trigger, in ms, for the lowest band and the highest band. */
const COOLDOWN_LOW = 90;
const COOLDOWN_HIGH = 370;
/** The maximum number of ring-buffer slots that one frame can use. */
const MAX_PER_FRAME = 2;

/**
 * Where the drop of a band lands, as a fraction of the radius of the
 * sheet: the bass at the centre and the treble at the rim. The
 * visualizer uses the same function, thus the mapping is in one place.
 */
export const bandRadius = (band: number, bands: number) =>
  bands <= 1 ? 0 : band / (bands - 1);

/**
 * The wavenumber of a band, as a multiple of `uK` (`uDropK` in the
 * shader). The bass makes long wide rings and the treble makes tight
 * rings. This part of the effect needs the per-drop wavenumber, because
 * one global `uK` would give a kick and a cymbal ripples with the same
 * spacing.
 */
export const bandWavenumber = (band: number, bands: number) =>
  0.45 + 1.9 * bandRadius(band, bands);

/**
 * Returns a detector that holds its own rolling state. Call the detector
 * one time a frame with the spectrum and `performance.now()`.
 */
export function createOnsetDetector(bands: number) {
  const mean = new Float32Array(bands);
  const readyAt = new Float32Array(bands);
  const hits: DropEvent[] = [];

  const cooldownFor = (band: number) =>
    COOLDOWN_LOW + (COOLDOWN_HIGH - COOLDOWN_LOW) * bandRadius(band, bands);

  return function detect(spectrum: Float32Array, now: number): DropEvent[] {
    hits.length = 0;
    for (let band = 0; band < bands; band++) {
      const level = spectrum[band] ?? 0;
      const average = mean[band];
      // The code updates the mean after the test, thus it compares a
      // band with its previous value and not with a mean that the hit
      // increased.
      mean[band] = average + (level - average) * MEAN_RATE;

      if (now < readyAt[band]) continue;
      if (level < ONSET_FLOOR || level < average * ONSET_RATIO) continue;
      readyAt[band] = now + cooldownFor(band);
      hits.push({ band, strength: Math.min(1, level) });
    }

    if (hits.length <= MAX_PER_FRAME) return hits;
    return hits.sort((a, b) => b.strength - a.strength).slice(0, MAX_PER_FRAME);
  };
}
