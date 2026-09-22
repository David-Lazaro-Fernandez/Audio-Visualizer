/**
 * Controller-style key bindings for the blade dashboard. Space, Enter or the
 * A key is the A button; Escape (or the B key) is the B button. Anything that
 * opens a screen listens for `isBackKey` to close it, so Back is only ever
 * handled where there's actually somewhere to go back to.
 */
type AnyKeyEvent = Pick<KeyboardEvent, "key">;

export function isSelectKey(e: AnyKeyEvent) {
  return e.key === " " || e.key === "Enter" || e.key === "a" || e.key === "A";
}

/** Keys the browser already turns into a click on a focused <button>. */
export function isNativeButtonActivationKey(e: AnyKeyEvent) {
  return e.key === " " || e.key === "Enter";
}

export function isBackKey(e: AnyKeyEvent) {
  return e.key === "Escape" || e.key === "b" || e.key === "B";
}

/**
 * The Y and X buttons — the contextual half of the legend (§6.5). Only
 * the Music Player binds them so far; everywhere else those slots are
 * dimmed, and a dimmed slot must not answer a key.
 */
export function isYKey(e: AnyKeyEvent) {
  return e.key === "y" || e.key === "Y";
}

export function isXKey(e: AnyKeyEvent) {
  return e.key === "x" || e.key === "X";
}

/**
 * The shoulder bumpers, as 1 and 2 — there are no letters to borrow, and
 * the number row sits where the bumpers do: leftmost and next to it. The
 * console cycled the Music Player's visualizer with them (§6.16), and
 * showed them as hints in the corners of the visualizer itself rather
 * than in the four-slot legend (§6.5), which has no room for them.
 */
export function isLeftBumperKey(e: AnyKeyEvent) {
  return e.key === "1";
}

export function isRightBumperKey(e: AnyKeyEvent) {
  return e.key === "2";
}
