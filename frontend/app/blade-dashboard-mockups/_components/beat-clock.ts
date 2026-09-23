/**
 * The beat clock: a tempo and a beat phase, inferred from the onsets of
 * the live spectrum (DESIGN.md §6.16).
 *
 * Everything that the player draws to date *reacts*. An onset arrives
 * and something moves, thus each answer is late by the time that the
 * detector needs to be sure. A phase is the other thing: it says where
 * the music is between two beats, thus a visualizer can act *on* a beat
 * and not after one.
 *
 * This is a module-level store, for the reasons of `blade-pulse.ts`.
 * The readers are renderers and not components, several of them run at
 * one time, and the value changes 60 times a second and must stay out
 * of React state. One hook writes (`use-beat-clock.ts`) and the
 * renderers read.
 *
 * ## How the tempo comes out
 *
 * The store keeps the recent onsets, each with a strength and a time,
 * and evaluates one term of a Fourier transform of that train of events
 * at each candidate tempo. For a period P the code sums
 * `w * exp(i * 2*pi * t / P)` over the onsets. The magnitude of that sum
 * says how much the onsets cluster at one position in the bar of that
 * period, which is the definition of a tempo that fits, and the
 * argument gives where that position is, which is the phase. One
 * quantity gives both, and no part of it is a heuristic.
 *
 * A transform of events prefers the *fastest* period that fits: onsets
 * that land every P/2 cancel at the frequency 1/P, and align at 2/P.
 * Thus a 100 BPM song also scores at 200 BPM. This is the octave error
 * of every tempo tracker. The fix is a prior: a log-normal weight
 * around 120 BPM, which is where the tempo of most music is, and
 * hysteresis, thus the estimate does not change octave in the middle of
 * a song because one bar was busy.
 *
 * ## Why a confidence
 *
 * A preview of speech, of ambient music or of a fade has no beat, and a
 * clock that invents one is worse than no clock. The magnitude of the
 * sum, normalised by the weights, is already a measure of fit: 1 when
 * each onset lands at one phase, near 0 when the onsets are spread.
 * That number is the confidence, and a reader that finds it low must
 * use the reactive behaviour that it had before. `WarpVisualizer.tsx`
 * is the first such reader.
 *
 * ## Why nothing tells it that the music stopped
 *
 * As in `blade-pulse.ts`: the weight of an onset falls with its age,
 * thus a store that no one feeds loses its evidence, the confidence
 * falls to zero, and a reader that asks in silence finds no beat with
 * no other work.
 *
 * The idea of a beat that changes a *state* and does not move a thing
 * comes from Geiss (1998): its warp map changed on a beat and then
 * stayed. Refer to `WarpVisualizer.tsx`.
 */

import { bandRadius } from "./audio-drops";

/** The range of tempos that the code considers. */
export const MIN_BPM = 70;
export const MAX_BPM = 200;
/** The number of candidate periods, log-spaced across that range. */
const CANDIDATES = 96;
/** The centre and the width, in octaves, of the prior over the tempo. */
const PRIOR_BPM = 120;
const PRIOR_OCTAVES = 0.9;

/** Onsets older than this do not count. */
const HISTORY_S = 6;
/** The size of the ring of onsets. Six seconds of dense music fits. */
const MAX_ONSETS = 128;
/** The age at which the weight of an onset is half. */
const HALF_LIFE_S = 2.5;
/** The number of onsets for a full confidence. Below it the value scales down. */
const MIN_ONSETS = 8;

/** The period between two estimates. At 60 fps that is one in eleven frames. */
const REESTIMATE_MS = 180;
/**
 * The margin that a new period needs to replace the current one.
 *
 * Without it the estimate moves between a tempo and its double at each
 * pass, because the two scores are close by construction. With it a
 * change needs a candidate that is clearly better.
 */
const KEEP_MARGIN = 1.1;

/** The rise and the fall of the confidence, for each estimate. */
const CONFIDENCE_RISE = 0.3;
const CONFIDENCE_FALL = 0.12;

/**
 * The confidence at which a reader can trust the phase.
 *
 * It is exported, because the value is a contract between this file and
 * its readers and not a private constant: a reader below it must fall
 * back, and the two must agree where the line is.
 */
export const BEAT_LOCKED = 0.45;

/**
 * How much the onset of a band counts toward the tempo.
 *
 * The tempo of music is in its percussion, which is low and middle. The
 * treble carries the cymbals, which fire almost continuously and say
 * little about where the beat is. Thus a treble onset counts near half.
 * This is a weight and not a cut, because a hi-hat on the off-beat is
 * still evidence.
 */
export const beatBandWeight = (band: number, bands: number) =>
  1 - 0.55 * bandRadius(band, bands);

/** What a reader sees. Refer to `beatClock`. */
export interface BeatClockReading {
  /** The tempo, or 0 with no estimate. */
  bpm: number;
  /** Where the music is between two beats, 0..1. 0 is the beat itself. */
  phase: number;
  /** A count of the beats that passed. It only increases. */
  beat: number;
  /** How much the phase deserves trust, 0..1. */
  confidence: number;
  /** `confidence >= BEAT_LOCKED`, which is the test that each reader makes. */
  locked: boolean;
}

// The candidate periods and their priors. Both are constant, thus the
// code builds them one time.
const periods = new Float64Array(CANDIDATES);
const priors = new Float64Array(CANDIDATES);
for (let i = 0; i < CANDIDATES; i++) {
  const bpm = MIN_BPM * Math.pow(MAX_BPM / MIN_BPM, i / (CANDIDATES - 1));
  periods[i] = 60 / bpm;
  const octaves = Math.log2(bpm / PRIOR_BPM) / PRIOR_OCTAVES;
  priors[i] = Math.exp(-0.5 * octaves * octaves);
}

// The ring of onsets.
const times = new Float64Array(MAX_ONSETS);
const strengths = new Float32Array(MAX_ONSETS);
let head = 0;
let stored = 0;

// The onsets that are still young, copied out one time for each
// estimate. The inner loop runs for each candidate, thus the age weight
// must not be computed inside it.
const liveT = new Float64Array(MAX_ONSETS);
const liveW = new Float64Array(MAX_ONSETS);
let liveN = 0;

let chosen = -1;
let offset = 0;
let confidence = 0;
let beat = 0;
let lastPhase = 0;
let estimatedAt = -Infinity;
let advancedAt = -Infinity;

/**
 * One object, mutated in place and returned again.
 *
 * The readers ask at each frame and there are several of them, thus a
 * new object for each call is garbage that the collector must clear 300
 * times a second. This is the rule that the spectrum follows
 * (`use-audio-spectrum.ts`): a reader takes the values and must not
 * keep the object.
 */
const reading: BeatClockReading = {
  bpm: 0,
  phase: 0,
  beat: 0,
  confidence: 0,
  locked: false,
};

/**
 * Records an onset. `strength` is 0..1 and should already carry
 * `beatBandWeight`.
 *
 * The caller must give one event for each frame and not one for each
 * band: a snare lights a dozen bands at one time, and a dozen events at
 * one instant would say that the music has a dozen beats there.
 */
export function pushBeatOnset(strength: number, now: number) {
  times[head] = now;
  strengths[head] = strength;
  head = (head + 1) % MAX_ONSETS;
  if (stored < MAX_ONSETS) stored++;
}

/** Copies the onsets that are still young into `liveT` / `liveW`. */
function collect(now: number) {
  liveN = 0;
  for (let i = 0; i < stored; i++) {
    const age = (now - times[i]) / 1000;
    if (age < 0 || age > HISTORY_S) continue;
    liveT[liveN] = times[i] / 1000;
    liveW[liveN] = strengths[i] * Math.pow(2, -age / HALF_LIFE_S);
    liveN++;
  }
}

/**
 * Picks the period and the phase, and updates the confidence.
 *
 * The scores of the candidates are not kept: the code needs the best
 * one and the current one, thus it tracks those two while it goes.
 */
function estimate(now: number) {
  estimatedAt = now;
  collect(now);

  let total = 0;
  for (let i = 0; i < liveN; i++) total += liveW[i];
  if (liveN < 2 || total <= 0) {
    confidence += (0 - confidence) * CONFIDENCE_FALL;
    return;
  }

  let bestIndex = -1;
  let bestScore = -1;
  let bestOffset = 0;
  let bestFit = 0;
  let chosenScore = -1;
  let chosenOffset = 0;
  let chosenFit = 0;

  for (let c = 0; c < CANDIDATES; c++) {
    const period = periods[c];
    let re = 0;
    let im = 0;
    for (let i = 0; i < liveN; i++) {
      const angle = (2 * Math.PI * liveT[i]) / period;
      re += liveW[i] * Math.cos(angle);
      im += liveW[i] * Math.sin(angle);
    }
    // 0..1: 1 when each onset is at one phase of this period.
    const fit = Math.hypot(re, im) / total;
    const score = fit * priors[c];
    // The argument of the sum is where that phase is, in turns.
    const turns = Math.atan2(im, re) / (2 * Math.PI);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = c;
      bestOffset = turns;
      bestFit = fit;
    }
    if (c === chosen) {
      chosenScore = score;
      chosenOffset = turns;
      chosenFit = fit;
    }
  }

  // Hysteresis. The current period holds unless a candidate is clearly
  // better, thus the estimate does not move between a tempo and its
  // double.
  const keep = chosenScore >= 0 && chosenScore * KEEP_MARGIN >= bestScore;
  if (!keep) {
    chosen = bestIndex;
    chosenOffset = bestOffset;
    chosenFit = bestFit;
  }
  offset = chosenOffset - Math.floor(chosenOffset);

  // Few onsets can fit any period well, thus a short history must not
  // give a full confidence.
  const target = chosenFit * Math.min(1, liveN / MIN_ONSETS);
  const rate = target > confidence ? CONFIDENCE_RISE : CONFIDENCE_FALL;
  confidence += (target - confidence) * rate;
}

/**
 * Brings the clock to `now`. It is safe to call it several times in one
 * frame, as `fall` in `blade-pulse.ts` is: time that does not move
 * changes nothing.
 */
function advance(now: number) {
  if (now <= advancedAt) return;
  advancedAt = now;
  if (now - estimatedAt >= REESTIMATE_MS) estimate(now);

  if (chosen < 0) {
    reading.bpm = 0;
    reading.phase = 0;
    reading.beat = beat;
    reading.confidence = confidence;
    reading.locked = false;
    return;
  }

  const period = periods[chosen];
  const turns = now / 1000 / period - offset;
  const phase = turns - Math.floor(turns);
  // A wrap is a fall of near a full turn. The test is not `phase <
  // lastPhase`, because an estimate moves the offset a little and that
  // small step back is not a beat.
  if (lastPhase - phase > 0.5) beat++;
  lastPhase = phase;

  reading.bpm = 60 / period;
  reading.phase = phase;
  reading.beat = beat;
  reading.confidence = confidence;
  reading.locked = confidence >= BEAT_LOCKED;
}

/**
 * The clock at `now`. Each renderer reads it one time a frame.
 *
 * The object is shared and is valid until the next call. Read the
 * fields; do not keep it.
 */
export function beatClock(now: number): BeatClockReading {
  advance(now);
  return reading;
}
