"use client";

/**
 * Offline spectrogram of a song preview: decode the whole clip, then walk
 * an FFT across it to get a time x frequency grid of levels.
 *
 * Deliberately **not** an `AnalyserNode`. That only reports what is
 * passing through it right now, so it can only ever build a rolling
 * window of the last second or two — which is what the Music Player's
 * visualizers do (DESIGN.md §6.16). This page wants the *whole* interval
 * at once, as one object you can turn around and look at, so the
 * transform has to be done by hand over the decoded samples. An
 * `OfflineAudioContext` would not help: its graph still has no way to
 * hand back per-frame spectra.
 *
 * Only a **one-second window** is analysed, not the whole preview. Thirty
 * seconds of hip-hop at 46 ms a slice is a wall of detail that averages
 * into mush; one second is a bar or two, where you can actually see the
 * kick, the snare and the hats as separate events.
 *
 * That makes the hop matter. At a 2048-sample window with no overlap one
 * second is only 21 slices, which is a coarse time axis for something
 * whose whole subject is time. So the windows overlap eightfold: window
 * *length* sets frequency resolution and *hop* sets time resolution, and
 * they are independent — 2048 keeps 21 Hz bins for the bass while a hop
 * of 256 gives a slice every 5.8 ms.
 *
 * The window also *follows playback*, so the transform is incremental:
 * see `SlidingSpectrogram` below.
 */

/** Window length. 2048 at 44.1 kHz is ~21 Hz resolution and ~46 ms. */
const FFT_SIZE = 2048;
/** Frequency range the bands cover, log-spaced, as elsewhere in the app. */
const MIN_HZ = 30;
const MAX_HZ = 16000;
/** Level floor and ceiling in dBFS; anything quieter than the floor is 0. */
const MIN_DB = -85;
const MAX_DB = -5;


/**
 * In-place iterative radix-2 FFT.
 *
 * Twiddles are precomputed rather than advanced by repeated complex
 * multiplication: the recurrence is shorter to write but drifts over a
 * thousand steps, and the drift lands in exactly the high bins a
 * spectrogram is read for.
 */
function makeFft(size: number) {
  const half = size >> 1;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / size);
    sin[i] = Math.sin((-2 * Math.PI * i) / size);
  }

  return function fft(re: Float64Array, im: Float64Array) {
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let len = 2; len <= size; len <<= 1) {
      const step = size / len;
      const mid = len >> 1;
      for (let start = 0; start < size; start += len) {
        for (let k = 0; k < mid; k++) {
          const wr = cos[k * step];
          const wi = sin[k * step];
          const a = start + k;
          const b = a + mid;
          const vr = re[b] * wr - im[b] * wi;
          const vi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - vr;
          im[b] = im[a] - vi;
          re[a] += vr;
          im[a] += vi;
        }
      }
    }
  };
}

/**
 * Bin index for each band edge, log-spaced and forced strictly
 * increasing: at the bottom of the range several bands round to the same
 * bin, and bands sharing bins would read as one.
 */
function bandEdges(bands: number, binCount: number, nyquist: number) {
  const binHz = nyquist / binCount;
  const ratio = Math.pow(MAX_HZ / MIN_HZ, 1 / bands);
  const edges = new Int32Array(bands + 1);
  let previous = -1;
  for (let i = 0; i <= bands; i++) {
    const hz = MIN_HZ * Math.pow(ratio, i);
    previous = Math.min(binCount - 1, Math.max(previous + 1, Math.round(hz / binHz)));
    edges[i] = previous;
  }
  return edges;
}

/** Mono mix of a decoded buffer; a spectrogram has no use for stereo. */
function toMono(buffer: AudioBuffer) {
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) mono[i] += data[i];
  }
  if (buffer.numberOfChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= buffer.numberOfChannels;
  }
  return mono;
}

/** Length of the window analysed, in seconds. */
export const WINDOW_SECONDS = 1;

export interface AnalyseOptions {
  bands?: number;
  /**
   * Samples between windows. Smaller overlaps more and buys time
   * resolution; at 256 the windows overlap eightfold.
   */
  hop?: number;
  /** Seconds into the clip to start at. */
  startTime?: number;
  /** Seconds to analyse. */
  seconds?: number;
}

/**
 * Fetches and decodes a preview.
 *
 * Split from the transform so that moving the window costs nothing: the
 * decoded buffer is the expensive part — a network round trip and an
 * AAC decode — and re-running it every time a slider moves would make
 * choosing which second to look at unusable.
 *
 * The clip is fetched as an ArrayBuffer rather than played through an
 * element: `decodeAudioData` needs the whole encoded file, and Apple
 * serves these with `Access-Control-Allow-Origin: *`, so it can be read
 * cross-origin without a proxy.
 */
export async function decodePreview(previewUrl: string): Promise<AudioBuffer> {
  const response = await fetch(previewUrl);
  if (!response.ok) throw new Error(`Preview fetch failed (${response.status})`);
  const encoded = await response.arrayBuffer();

  const context = new AudioContext();
  try {
    // An AudioBuffer outlives the context that decoded it, and this one
    // is never used to play anything.
    return await context.decodeAudioData(encoded);
  } finally {
    void context.close();
  }
}

/**
 * A one-second window over a decoded buffer that can slide with
 * playback.
 *
 * The transform is incremental rather than a single pass, because the
 * window follows what is being heard. Recomputing all 165 slices every
 * frame would be pure waste: at a 256-sample hop each slice is 5.8 ms,
 * so at 60 fps only about three slices are *new* per frame. Those three
 * get an FFT and the rest simply age, which is the same trick the Music
 * Player's spectrogram uses on live audio (DESIGN.md §6.16) — except
 * here the samples are already in hand, so the window can also be thrown
 * anywhere in the clip instantly.
 *
 * Slices live in a ring and `head` is the newest. Callers read
 * `levels` through it rather than being handed a re-sorted copy, since
 * the consumer is a draw loop that is walking every cell anyway.
 */
export class SlidingSpectrogram {
  readonly frames: number;
  readonly bands: number;
  /** `frames * bands` levels in 0..1, row-major, in **ring** order. */
  readonly levels: Float32Array;
  readonly bandHz: Float32Array;
  readonly clipDuration: number;
  readonly hop: number;

  private readonly samples: Float32Array;
  private readonly sampleRate: number;
  private readonly edges: Int32Array;
  private readonly window: Float64Array;
  private readonly fft: (re: Float64Array, im: Float64Array) => void;
  private readonly re = new Float64Array(FFT_SIZE);
  private readonly im = new Float64Array(FFT_SIZE);
  private readonly binCount = FFT_SIZE >> 1;

  /** Ring index of the newest slice. */
  private ringHead = 0;
  /** Absolute slice index of the newest slice; slice i starts at i * hop. */
  private newest = -1;
  /**
   * Bumped on every change. The draw loop compares this rather than
   * `head`, because a refill can land on the same ring index it was
   * already on and would otherwise go unnoticed.
   */
  private revision = 0;

  constructor(
    buffer: AudioBuffer,
    { bands = 64, hop = 256, seconds = WINDOW_SECONDS }: AnalyseOptions = {},
  ) {
    this.samples = toMono(buffer);
    this.sampleRate = buffer.sampleRate;
    this.clipDuration = buffer.duration;
    this.hop = hop;
    this.bands = bands;
    this.frames = Math.max(1, Math.floor((seconds * buffer.sampleRate) / hop));
    this.levels = new Float32Array(this.frames * bands);
    this.edges = bandEdges(bands, this.binCount, buffer.sampleRate / 2);
    this.fft = makeFft(FFT_SIZE);

    // Hann window, so a tone that does not sit exactly on a bin does not
    // smear its energy across the whole spectrum.
    this.window = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));
    }

    const ratio = Math.pow(MAX_HZ / MIN_HZ, 1 / bands);
    this.bandHz = new Float32Array(bands);
    for (let band = 0; band < bands; band++) {
      this.bandHz[band] = MIN_HZ * Math.pow(ratio, band + 0.5);
    }
  }

  /** Ring index of the newest slice; the oldest is the one after it. */
  get head() {
    return this.ringHead;
  }

  /** Changes whenever the levels do; see `revision`. */
  get version() {
    return this.revision;
  }

  /** Seconds into the clip that the oldest slice held starts at. */
  get startTime() {
    const oldest = Math.max(0, this.newest - this.frames + 1);
    return (oldest * this.hop) / this.sampleRate;
  }

  /** Seconds the window spans. */
  get duration() {
    return (this.frames * this.hop) / this.sampleRate;
  }

  /** The last slice index the clip has samples for. */
  private get lastSlice() {
    return Math.max(0, Math.floor((this.samples.length - FFT_SIZE) / this.hop));
  }

  /** Throws the whole window somewhere else in the clip. */
  fill(startTime: number) {
    const first = Math.max(
      0,
      Math.min(
        Math.round((startTime * this.sampleRate) / this.hop),
        Math.max(0, this.lastSlice - this.frames + 1),
      ),
    );
    for (let i = 0; i < this.frames; i++) {
      this.computeInto(first + i, i);
    }
    this.ringHead = this.frames - 1;
    this.newest = first + this.frames - 1;
    this.revision++;
  }

  /**
   * Slides the window so its newest slice is the latest one whose audio
   * has already been heard at `time`.
   *
   * A slice covers FFT_SIZE samples from its start, so the newest one
   * that has fully sounded is `(time * rate - FFT_SIZE) / hop`. Jumping
   * further than the window is wide — a seek, or a tab that was
   * backgrounded — costs less as a refill than as a loop of single
   * slices, so it falls back to `fill`.
   */
  advanceTo(time: number) {
    const target = Math.min(
      this.lastSlice,
      Math.floor((time * this.sampleRate - FFT_SIZE) / this.hop),
    );
    if (target <= this.newest) return;
    if (this.newest < 0 || target - this.newest >= this.frames) {
      this.fill(Math.max(0, time - this.duration));
      return;
    }
    for (let slice = this.newest + 1; slice <= target; slice++) {
      this.ringHead = (this.ringHead + 1) % this.frames;
      this.computeInto(slice, this.ringHead);
    }
    this.newest = target;
    this.revision++;
  }

  /** One FFT, banded into `row` of the ring. */
  private computeInto(slice: number, row: number) {
    const offset = slice * this.hop;
    const { re, im, window, samples } = this;
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = (samples[offset + i] ?? 0) * window[i];
      im[i] = 0;
    }
    this.fft(re, im);

    const base = row * this.bands;
    const span = MAX_DB - MIN_DB;
    for (let band = 0; band < this.bands; band++) {
      const from = this.edges[band];
      const to = Math.max(from + 1, this.edges[band + 1]);
      let power = 0;
      for (let bin = from; bin < to; bin++) {
        power += re[bin] * re[bin] + im[bin] * im[bin];
      }
      // Mean power over the band, then dBFS against the window's gain.
      const mean = power / (to - from);
      const db = 10 * Math.log10(mean / (this.binCount * this.binCount) + 1e-12);
      this.levels[base + band] = Math.max(0, Math.min(1, (db - MIN_DB) / span));
    }
  }
}
