"use client";

/**
 * Turns a live spectrum into water-drop events (DESIGN.md §6.16).
 *
 * The wave field already is a damped radial sinusoid per drop
 * (`ripplePacket` in `app/_water/water-field.ts`), so making it follow
 * music is not a physics problem but a *triggering* one: what counts as
 * a drop landing.
 *
 * It has to be **onsets, not levels**. A drop is a transient - a kick, a
 * snare, a plucked string - so the test is "did this band just jump
 * above where it has been sitting", against a rolling mean per band. A
 * naive level threshold would fire every frame a band was loud, sixty
 * drops a second, and the sixteen-slot ring buffer would be consumed and
 * recycled before a single ripple had travelled anywhere.
 *
 * Two guards follow from that ring buffer being the scarce resource:
 *
 * - **Cooldowns rise with frequency.** Cymbals and hi-hats fire almost
 *   continuously; left alone they would overwrite the bass swell before
 *   it spread. Low bands may retrigger in 90 ms, the top band not for
 *   nearly half a second.
 * - **At most two drops per frame**, strongest first. A snare hit lights
 *   up a dozen bands at once, and all twelve would otherwise land
 *   together and flush the buffer.
 */

/** A band that just hit, and how hard. */
export interface DropEvent {
  band: number;
  /** 0..1, fed to the drop's `strength`. */
  strength: number;
}

/** How fast the rolling mean follows the signal; ~0.3 s at 60 fps. */
const MEAN_RATE = 0.05;
/** A band must exceed its mean by this much to count as an onset. */
const ONSET_RATIO = 1.6;
/** ...and be at least this loud, so silence does not trigger on noise. */
const ONSET_FLOOR = 0.1;
/** Retrigger cooldown, in ms, for the lowest and the highest band. */
const COOLDOWN_LOW = 90;
const COOLDOWN_HIGH = 370;
/** Never spend more than this much of the ring buffer in one frame. */
const MAX_PER_FRAME = 2;

/**
 * Where a band's drop lands, as a fraction of the sheet's radius: bass at
 * the centre, treble at the rim. Shared with the visualizer so the
 * mapping is stated once.
 */
export const bandRadius = (band: number, bands: number) =>
  bands <= 1 ? 0 : band / (bands - 1);

/**
 * A band's wavenumber, as a multiple of `uK` (`uDropK` in the shader).
 * Bass makes long, wide rings and treble tight ones — the half of the
 * effect that needs the per-drop wavenumber, since one global `uK` would
 * give a kick and a cymbal identically spaced ripples.
 */
export const bandWavenumber = (band: number, bands: number) =>
  0.45 + 1.9 * bandRadius(band, bands);

/**
 * Returns a detector closed over its own rolling state. Call it once per
 * frame with the spectrum and `performance.now()`.
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
      // The mean is updated *after* the test, so a band is compared with
      // where it was, not with a figure the hit has already inflated.
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
