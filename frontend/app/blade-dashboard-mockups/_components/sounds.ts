/**
 * UI sound effects for the blade dashboard, served from
 * `public/assets/sounds`. One cached <audio> element per cue; replaying a
 * cue restarts it from the top (like the 360 does when you skate down a
 * list), while different cues can overlap.
 *
 * Which cue goes where:
 * - `select`    hovering a selectable item (gamerpic, menu row, blade tab)
 * - `selectA`   clicking/confirming an item (A button)
 * - `back`      leaving a screen you can actually leave (ESC, B button, ×)
 * - `pageLeft`  / `pageRight` switching blades toward the left / right
 */
export type UiSound = "select" | "selectA" | "back" | "pageLeft" | "pageRight";

const SOUND_FILES: Record<UiSound, string> = {
  select: "13. Select.mp3",
  selectA: "10. Select A.mp3",
  back: "14. Back.mp3",
  pageLeft: "08. Page Left.mp3",
  pageRight: "09. Page Right.mp3",
};

const cache = new Map<UiSound, HTMLAudioElement>();

function audioFor(name: UiSound): HTMLAudioElement {
  let el = cache.get(name);
  if (!el) {
    el = new Audio(encodeURI(`/assets/sounds/${SOUND_FILES[name]}`));
    el.preload = "auto";
    cache.set(name, el);
  }
  return el;
}

/** Warm the cache so the first hover doesn't lag on a network fetch. Client only. */
export function preloadSounds() {
  if (typeof window === "undefined") return;
  for (const name of Object.keys(SOUND_FILES) as UiSound[]) audioFor(name).load();
}

export function playSound(name: UiSound) {
  if (typeof window === "undefined") return;
  const el = audioFor(name);
  el.currentTime = 0;
  // Browsers reject play() before the first user gesture (autoplay policy);
  // a silent hover is fine, so swallow that.
  void el.play().catch(() => {});
}

/**
 * Blade order, left to right. Moving to a higher index plays `pageRight`,
 * a lower one `pageLeft`; same index plays nothing.
 */
export function pageTurnSound(from: number, to: number): UiSound | null {
  if (to === from) return null;
  return to > from ? "pageRight" : "pageLeft";
}
