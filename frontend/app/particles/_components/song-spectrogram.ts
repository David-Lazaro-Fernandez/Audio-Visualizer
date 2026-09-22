"use client";

/**
 * Offline spectrogram of a song preview. The code decodes the full clip,
 * then moves an FFT across it to get a grid of levels in time and
 * frequency.
 *
 * This is not an `AnalyserNode`. An analyser reports only the audio that
 * passes through it now, thus it can build only a rolling window of the
 * last second or two. The visualizers of the Music Player work in that
 * way (DESIGN.md §6.16). This page needs the full interval at one time,
 * as one object that a user can turn and examine. Thus the transform
 * uses the decoded samples directly. An `OfflineAudioContext` does not
 * help, because its graph cannot return a spectrum for each frame.
 *
 * The code analyses a window of one second and not the full preview. 30
 * seconds of hip-hop at 46 ms a slice gives too much detail, and the
 * detail averages into mush. One second is one or two bars, where a user
 * can see the kick, the snare and the hats as separate events.
 *
 * Thus the hop is important. With a window of 2048 samples and no
 * overlap, one second is only 21 slices, which is a coarse time axis for
 * a display about time. Thus the windows overlap eight times. The length
 * of the window sets the frequency resolution and the hop sets the time
 * resolution, and the two are independent: 2048 keeps 21 Hz bins for the
 * bass, and a hop of 256 gives a slice each 5.8 ms.
 *
 * The window also follows the playback, thus the transform is
 * incremental. Refer to `SlidingSpectrogram` below.
 */

/** Window length. 2048 at 44.1 kHz gives near 21 Hz bins and near 46 ms. */
const FFT_SIZE = 2048;
/** Frequency range of the bands, log-spaced, as in the rest of the app. */
const MIN_HZ = 30;
const MAX_HZ = 16000;
/** Lowest and highest level in dBFS. A level below the floor becomes 0. */
const MIN_DB = -85;
const MAX_DB = -5;


/**
 * In-place iterative radix-2 FFT.
 *
 * The twiddle factors are precomputed. A recurrence of complex
 * multiplications is shorter to write, but it drifts across a thousand
 * steps, and the drift occurs in the high bins that a spectrogram shows.
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
 * Bin index of each band edge, log-spaced and always increasing. At the
 * bottom of the range several bands round to the same bin, and bands
 * that share bins look like one band.
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

/** Mono mix of a decoded buffer. A spectrogram does not need stereo. */
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

/** Length of the analysed window, in seconds. */
export const WINDOW_SECONDS = 1;

export interface AnalyseOptions {
  bands?: number;
  /**
   * Samples between two windows. A smaller value gives more overlap and
   * more time resolution. At 256 the windows overlap eight times.
   */
  hop?: number;
  /** The start position in the clip, in seconds. */
  startTime?: number;
  /** Seconds to analyse. */
  seconds?: number;
}

/**
 * Fetches and decodes a preview.
 *
 * This is separate from the transform, thus a move of the window costs
 * nothing. The decoded buffer is the expensive part: a network round
 * trip and an AAC decode. A decode at each move of a slider would make
 * the selection of a second unusable.
 *
 * The code fetches the clip as an ArrayBuffer and does not play it
 * through an element. `decodeAudioData` needs the full encoded file, and
 * Apple serves these files with `Access-Control-Allow-Origin: *`, thus a
 * cross-origin read needs no proxy.
 */
export async function decodePreview(previewUrl: string): Promise<AudioBuffer> {
  const response = await fetch(previewUrl);
  if (!response.ok) throw new Error(`Preview fetch failed (${response.status})`);
  const encoded = await response.arrayBuffer();

  const context = new AudioContext();
  try {
    // An AudioBuffer stays valid after the context closes, and this
    // context does not play anything.
    return await context.decodeAudioData(encoded);
  } finally {
    void context.close();
  }
}

/**
 * A window of one second over a decoded buffer. The window can slide
 * with the playback.
 *
 * The transform is incremental and not one pass, because the window
 * follows the audio that the user hears. To compute all 165 slices at
 * each frame is waste: at a hop of 256 samples a slice is 5.8 ms, thus
 * at 60 fps only near three slices are new at each frame. The code
 * computes an FFT for those three slices, and the other slices only
 * become older. The spectrogram of the Music Player uses the same method
 * on live audio (DESIGN.md §6.16). Here the samples are already
 * available, thus the window can also move to any position in the clip
 * immediately.
 *
 * The slices are in a ring and `head` is the newest slice. A caller
 * reads `levels` through `head` and does not get a sorted copy, because
 * the caller is a draw loop that reads each cell.
 */
export class SlidingSpectrogram {
  readonly frames: number;
  readonly bands: number;
  /** `frames * bands` levels in 0..1, row-major, in ring order. */
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

  /** Index of the newest slice in the ring. */
  private ringHead = 0;
  /** Absolute index of the newest slice. Slice i starts at i * hop. */
  private newest = -1;
  /**
   * Incremented at each change. The draw loop compares this value and
   * not `head`, because a refill can end on the same ring index. Such a
   * refill would not be visible in `head`.
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

    // Hann window, thus a tone that is not exactly on a bin does not
    // spread its energy across the full spectrum.
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

  /** Index of the newest slice in the ring. The next slice is the oldest. */
  get head() {
    return this.ringHead;
  }

  /** Changes at each change of the levels. Refer to `revision`. */
  get version() {
    return this.revision;
  }

  /** The start of the oldest slice, in seconds into the clip. */
  get startTime() {
    const oldest = Math.max(0, this.newest - this.frames + 1);
    return (oldest * this.hop) / this.sampleRate;
  }

  /** Length of the window, in seconds. */
  get duration() {
    return (this.frames * this.hop) / this.sampleRate;
  }

  /** The last slice index that the clip has samples for. */
  private get lastSlice() {
    return Math.max(0, Math.floor((this.samples.length - FFT_SIZE) / this.hop));
  }

  /** Moves the full window to another position in the clip. */
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
   * Slides the window. The newest slice becomes the last slice whose
   * audio the user heard at `time`.
   *
   * A slice covers FFT_SIZE samples from its start, thus the newest
   * slice that sounded fully is `(time * rate - FFT_SIZE) / hop`. A jump
   * that is longer than the window, after a seek or a backgrounded tab,
   * costs less as a refill than as a loop of single slices. Thus the
   * method calls `fill` for such a jump.
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

  /** One FFT, put into the bands of `row` in the ring. */
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
      // Mean power in the band, then dBFS against the gain of the window.
      const mean = power / (to - from);
      const db = 10 * Math.log10(mean / (this.binCount * this.binCount) + 1e-12);
      this.levels[base + band] = Math.max(0, Math.min(1, (db - MIN_DB) / span));
    }
  }
}
