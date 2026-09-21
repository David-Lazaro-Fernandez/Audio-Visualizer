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
