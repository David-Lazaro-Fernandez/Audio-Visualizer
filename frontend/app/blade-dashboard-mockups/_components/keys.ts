/**
 * The key bindings of the blade dashboard, in the form of a controller.
 * Space, Enter and the A key are the A button. Escape and the B key are
 * the B button. Each component that opens a screen listens for
 * `isBackKey` to close it. Thus only a component with a screen to close
 * answers Back.
 */
type AnyKeyEvent = Pick<KeyboardEvent, "key">;

export function isSelectKey(e: AnyKeyEvent) {
  return e.key === " " || e.key === "Enter" || e.key === "a" || e.key === "A";
}

/** The keys that the browser already makes into a click on a focused <button>. */
export function isNativeButtonActivationKey(e: AnyKeyEvent) {
  return e.key === " " || e.key === "Enter";
}

export function isBackKey(e: AnyKeyEvent) {
  return e.key === "Escape" || e.key === "b" || e.key === "B";
}

/**
 * The Y and X buttons, which are the contextual half of the legend
 * (§6.5). Only the Music Player binds them now. On the other screens
 * those slots are dimmed, and a dimmed slot must not answer a key.
 */
export function isYKey(e: AnyKeyEvent) {
  return e.key === "y" || e.key === "Y";
}

export function isXKey(e: AnyKeyEvent) {
  return e.key === "x" || e.key === "X";
}

/**
 * The shoulder bumpers, as 1 and 2. There is no letter to use for them,
 * and the number row is in the same position as the bumpers: at the left
 * end and next to it. The console used the bumpers to cycle the
 * visualizer of the Music Player (§6.16). It showed them as hints in the
 * corners of the visualizer and not in the four-slot legend (§6.5),
 * which has no space for them.
 */
export function isLeftBumperKey(e: AnyKeyEvent) {
  return e.key === "1";
}

export function isRightBumperKey(e: AnyKeyEvent) {
  return e.key === "2";
}
