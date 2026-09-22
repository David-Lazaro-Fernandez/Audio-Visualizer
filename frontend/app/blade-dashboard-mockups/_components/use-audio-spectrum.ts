"use client";

import { useEffect, useRef } from "react";

/**
 * The frequency range the bands span. Below 30 Hz is mostly rumble, and
 * above 14 kHz there is rarely anything worth a whole band.
 */
const MIN_HZ = 30;
const MAX_HZ = 14000;

/**
 * Bands are spaced **logarithmically**, about a third of an octave each.
 *
 * This is not a detail. Splitting the FFT's bins evenly — which is the
 * obvious thing, and what this did first — puts everything from 20 to
 * 470 Hz in a single band: the whole bass register, where a kick, a bass
 * line and most of the rhythm live, reduced to one twenty-eighth of the
 * display while twenty-seven bands share the upper harmonics. The result
 * looks unrelated to the music, because the part of the music you can
 * feel is not resolved at all. Log spacing gives 20–250 Hz ten bands of
 * its own.
 */
export function bandHzRange(band: number, bands: number): [number, number] {
  const ratio = Math.pow(MAX_HZ / MIN_HZ, 1 / bands);
  return [MIN_HZ * Math.pow(ratio, band), MIN_HZ * Math.pow(ratio, band + 1)];
}

/**
 * The FFT bin each band starts at. Forced strictly increasing: at the
 * bottom of the range several bands round to the same bin, and bands
 * sharing bins would read as one.
 */
function bandEdges(bands: number, binCount: number, nyquist: number) {
  const binHz = nyquist / binCount;
  const edges = new Int32Array(bands + 1);
  let previous = -1;
  for (let i = 0; i <= bands; i++) {
    const hz = bandHzRange(i, bands)[0];
    previous = Math.min(binCount - 1, Math.max(previous + 1, Math.round(hz / binHz)));
    edges[i] = previous;
  }
  return edges;
}

/**
 * A live spectrum from an `<audio>` element, for the visualizer (§6.16).
 *
 * This is the piece that makes the player real rather than a mock. The
 * store's 30-second previews are served with
 * `Access-Control-Allow-Origin: *`, so with `crossOrigin="anonymous"` on
 * the element its samples are readable and a Web Audio `AnalyserNode`
 * can see them. Without that header the graph would still play but
 * `getByteFrequencyData` would return nothing but zeros, which is the
 * usual reason a visualizer sits flat.
 *
 * Returns a stable `Float32Array` of `bands` values, 0..1, **mutated in
 * place**. Deliberately not React state: this updates sixty times a
 * second, and re-rendering the player that often to move some bars would
 * be absurd. The visualizer reads the same array each frame.
 *
 * One `AudioContext` per element, created lazily and closed on unmount.
 * A context can only be started from a user gesture, so it is resumed on
 * the first play rather than at mount.
 */
export function useAudioSpectrum(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  bands: number,
) {
  const spectrumRef = useRef<Float32Array>(new Float32Array(bands));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const spectrum = spectrumRef.current;
    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let bins: Uint8Array | null = null;
    let edges: Int32Array | null = null;
    let frame = 0;

    const connect = () => {
      if (context) {
        // Autoplay policy leaves a context suspended until a gesture.
        if (context.state === "suspended") void context.resume();
        return;
      }
      try {
        context = new AudioContext();
        analyser = context.createAnalyser();
        // 4096 gives ~12 Hz bins at 48 kHz. 1024's 47 Hz bins cannot tell
        // 40 Hz from 80 Hz, which is two octaves of bass in one bin and
        // makes log-spaced low bands pointless.
        analyser.fftSize = 4096;
        // Smoothing is left fairly low; the visualizer does its own
        // rise-fast/fall-slow envelope on top.
        analyser.smoothingTimeConstant = 0.6;
        bins = new Uint8Array(analyser.frequencyBinCount);
        edges = bandEdges(bands, bins.length, context.sampleRate / 2);
        context.createMediaElementSource(audio).connect(analyser);
        analyser.connect(context.destination);
      } catch {
        // No Web Audio, or the element is already bound to a context:
        // leave the visualizer on its synthetic signal.
        context = null;
        analyser = null;
      }
    };

    const sample = () => {
      frame = requestAnimationFrame(sample);
      if (!analyser || !bins || !edges) return;
      analyser.getByteFrequencyData(bins);
      for (let band = 0; band < bands; band++) {
        const from = edges[band];
        const to = Math.max(from + 1, edges[band + 1]);
        let total = 0;
        for (let i = from; i < to; i++) total += bins[i];
        spectrum[band] = total / (to - from) / 255;
      }
    };

    const onPlay = () => {
      connect();
      if (!frame) frame = requestAnimationFrame(sample);
    };

    audio.addEventListener("play", onPlay);
    return () => {
      audio.removeEventListener("play", onPlay);
      cancelAnimationFrame(frame);
      void context?.close();
    };
  }, [audioRef, bands]);

  return spectrumRef.current;
}
