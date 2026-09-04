/**
 * Controller-style key bindings for the blade dashboard. Space (or the A
 * key) is the A button; Escape (or the B key) is the B button. Anything that
 * opens a screen listens for `isBackKey` to close it, so Back is only ever
 * handled where there's actually somewhere to go back to.
 */
type AnyKeyEvent = Pick<KeyboardEvent, "key">;

export function isSelectKey(e: AnyKeyEvent) {
  return e.key === " " || e.key === "a" || e.key === "A";
}

export function isBackKey(e: AnyKeyEvent) {
  return e.key === "Escape" || e.key === "b" || e.key === "B";
}
