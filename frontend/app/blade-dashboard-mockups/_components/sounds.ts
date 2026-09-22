/**
 * The UI sounds of the blade dashboard, served from
 * `public/assets/sounds`. There is one cached <audio> element for each
 * cue. A second play of one cue starts it again from the beginning, as
 * the console does when a user moves quickly down a list. Two different
 * cues can play at the same time.
 *
 * The cues are:
 * - `select`: a hover on a selectable item, such as the gamer picture, a
 *   menu row or a blade tab.
 * - `selectA`: a click on an item, or a confirmation with the A button.
 * - `back`: a user leaves a screen that can close, with ESC, the B
 *   button or the ×.
 * - `pageLeft` and `pageRight`: a blade switch to the left or the right.
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

/** Fills the cache, thus the first hover does not wait for a network fetch. Client only. */
export function preloadSounds() {
  if (typeof window === "undefined") return;
  for (const name of Object.keys(SOUND_FILES) as UiSound[]) audioFor(name).load();
}

export function playSound(name: UiSound) {
  if (typeof window === "undefined") return;
  const el = audioFor(name);
  el.currentTime = 0;
  // A browser refuses play() before the first user gesture, because of
  // the autoplay policy. A silent hover is acceptable, thus ignore the
  // error.
  void el.play().catch(() => {});
}

/**
 * The blade order, left to right. A move to a higher index plays
 * `pageRight` and a move to a lower index plays `pageLeft`. The same
 * index plays nothing.
 */
export function pageTurnSound(from: number, to: number): UiSound | null {
  if (to === from) return null;
  return to > from ? "pageRight" : "pageLeft";
}
