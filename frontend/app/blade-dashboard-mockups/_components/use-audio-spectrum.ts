"use client";

import { useEffect, useRef } from "react";

/**
 * The frequency range of the bands. Below 30 Hz the signal is usually
 * rumble. Above 14 kHz there is rarely enough content for a full band.
 */
const MIN_HZ = 30;
const MAX_HZ = 14000;

/**
 * The bands are spaced logarithmically, at near a third of an octave
 * each.
 *
 * This is important. An equal division of the FFT bins is the obvious
 * method, and this code used it first. That method puts all of 20 Hz to
 * 470 Hz in one band. Thus the full bass register, which holds the
 * kick, the bass line and most of the rhythm, gets one band of 28, and
 * 27 bands share the upper harmonics. The result looks unrelated to the
 * music, because the display does not resolve the part that a listener
 * feels. Log spacing gives 20 Hz to 250 Hz ten bands.
 */
export function bandHzRange(band: number, bands: number): [number, number] {
  const ratio = Math.pow(MAX_HZ / MIN_HZ, 1 / bands);
  return [MIN_HZ * Math.pow(ratio, band), MIN_HZ * Math.pow(ratio, band + 1)];
}

/**
 * The FFT bin where each band starts. The values always increase. At the
 * bottom of the range several bands round to the same bin, and bands
 * that share bins look like one band.
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
 * This hook makes the player real and not a mock. The store serves its
 * 30-second previews with `Access-Control-Allow-Origin: *`. Thus, with
 * `crossOrigin="anonymous"` on the element, the samples are readable
 * and a Web Audio `AnalyserNode` can see them. Without that header the
 * graph plays, but `getByteFrequencyData` returns only zeros. That is
 * the usual cause of a visualizer that stays flat.
 *
 * The hook returns one `Float32Array` of `bands` values, 0..1, and
 * mutates it in place. It is not React state: the values change 60
 * times a second, and a render of the player at that rate to move some
 * bars is not acceptable. The visualizer reads the same array at each
 * frame.
 *
 * There is one `AudioContext` for each element. The hook creates it at
 * the first use and closes it at the unmount. A context can start only
 * from a user gesture, thus the hook resumes it at the first play and
 * not at the mount.
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
    // `getByteFrequencyData` takes a view over an ArrayBuffer, not over
    // a SharedArrayBuffer, thus the buffer type is spelled out. Bare
    // `Uint8Array` widens to `ArrayBufferLike` and does not fit.
    let bins: Uint8Array<ArrayBuffer> | null = null;
    let edges: Int32Array | null = null;
    let frame = 0;

    const connect = () => {
      if (context) {
        // The autoplay policy keeps a context suspended until a gesture.
        if (context.state === "suspended") void context.resume();
        return;
      }
      try {
        context = new AudioContext();
        analyser = context.createAnalyser();
        // 4096 gives bins of near 12 Hz at 48 kHz. The 47 Hz bins of
        // 1024 cannot separate 40 Hz from 80 Hz. That is two octaves of
        // bass in one bin, and it makes the log-spaced low bands
        // useless.
        analyser.fftSize = 4096;
        // The smoothing stays low. The visualizer applies its own
        // rise-fast, fall-slow envelope.
        analyser.smoothingTimeConstant = 0.6;
        bins = new Uint8Array(analyser.frequencyBinCount);
        edges = bandEdges(bands, bins.length, context.sampleRate / 2);
        context.createMediaElementSource(audio).connect(analyser);
        analyser.connect(context.destination);
      } catch {
        // There is no Web Audio, or another context already uses the
        // element. Keep the visualizer on its synthetic signal.
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
