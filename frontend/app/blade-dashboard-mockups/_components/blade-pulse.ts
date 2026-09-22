/**
 * The audio pulse of the blade surface: how the section gradient answers
 * the bass (DESIGN.md §3.1, §6.16).
 *
 * This is a module-level store and not React context, for the same
 * reasons as `blade-water-controls.ts`. The readers are not components.
 * They are `BladeWaterRenderer` instances, and several run at the same
 * time: the blade canvas and each full-screen surface above it (§5.4),
 * each one with its own WebGL context. One store makes the gradient
 * under the player and the blade behind it breathe together. It also
 * keeps a value that changes 60 times a second out of React state, as
 * the spectrum does (`use-audio-spectrum.ts`).
 *
 * The flow is one-way: the player writes and the renderers read.
 *
 * The envelope rises fast and falls slowly. Thus a kick makes the panel
 * swell and settle, and not flash. The fall is also the reason that
 * nothing must tell this store that the music stopped. The code computes
 * the fall from the elapsed time, thus a surface that reads the store
 * while nothing plays, or that mounts long after the player closed,
 * finds the plain section colour with no other work.
 */

/** Bass below this fraction of full scale does not move the gradient. */
export const PULSE_FLOOR = 0.16;
/** A bass level of 1 / this above the floor gives a full pulse. */
export const PULSE_GAIN = 2.4;

/** Fraction of the distance to a louder reading taken at each frame. */
const ATTACK = 0.45;
/**
 * Seconds for the envelope to fall to 1/e. This time is long, thus the
 * gradient cannot flicker faster than two hertz at each density of the
 * music. This is the aim: the surface is full-screen, thus it must swell
 * and subside and must never flash.
 */
const RELEASE_S = 0.22;

/**
 * What a full pulse does to the gradient. The one envelope drives all
 * three values, and `blade-water-gl.ts` reads them into its GLSL:
 *
 * - `BLOOM` moves the stops outward, thus the bright core becomes
 *   larger.
 * - `HUE_DEG` rotates the colour about the grey axis.
 * - `LIFT` increases the brightness of the full gradient.
 *
 * The values are small. The gradient is the identity of the section
 * (§2.1), thus the bass can move it but must not replace it. At full
 * scale the Media blade is still clearly the blue blade.
 */
export const PULSE_BLOOM = 0.35;
export const PULSE_HUE_DEG = 12;
export const PULSE_LIFT = 0.18;

let level = 0;
let updatedAt = 0;

/** Advances the fall of the envelope to `now`. Safe to call two times in a frame. */
function fall(now: number) {
  const dt = (now - updatedAt) / 1000;
  if (!(dt > 0)) return;
  updatedAt = now;
  level *= Math.exp(-dt / RELEASE_S);
}

/**
 * Gives the store the bass reading of one frame, 0..1
 * (`use-blade-pulse.ts`). A reading that is quieter than the current
 * level goes to the fall. This is all of the rise fast, fall slow rule.
 */
export function pushBladePulse(bass: number, now: number) {
  fall(now);
  const target = Math.min(1, Math.max(0, (bass - PULSE_FLOOR) * PULSE_GAIN));
  if (target > level) level += (target - level) * ATTACK;
}

/** The envelope at `now`, 0..1. Each renderer reads it one time a frame. */
export function bladePulse(now: number): number {
  fall(now);
  return level;
}
