/**
 * The UI sounds of the blade dashboard, served from
 * `public/assets/sounds`. A second play of one cue starts it again from
 * the beginning, as the console does when a user moves quickly down a
 * list. Two different cues can play at the same time.
 *
 * The cues are:
 * - `select`: a hover on a selectable item, such as the gamer picture, a
 *   menu row or a blade tab.
 * - `selectA`: a click on an item, or a confirmation with the A button.
 * - `back`: a user leaves a screen that can close, with ESC, the B
 *   button or the ×.
 * - `pageLeft` and `pageRight`: a blade switch to the left or the right.
 * - `notification`: a notification slides in, such as the controller
 *   sign-in toast.
 *
 * The cues play through one Web Audio context, from buffers that
 * `preloadSounds` decodes up front, and not through <audio> elements.
 * A buffer source starts at its first sample on the next audio quantum.
 * An <audio> element must seek and buffer before it plays, which put a
 * gap in front of a cue, and the notification file (an MP4 in DASH
 * fragments) is slow to seek.
 *
 * The autoplay policy keeps the context suspended until the page gets a
 * user activation: a click, a tap or a key press. Controller input is
 * not a user activation in any browser, and no code can change that, so
 * a page that only a controller has touched stays silent. A hover is
 * not an activation either. `preloadSounds` listens for the first real
 * activation and resumes the context there, thus every cue after it
 * plays, whatever device sends it.
 *
 * A cue that is asked for while the context is suspended is not queued.
 * A queued hover would play much later, when the user clicks, and a
 * burst of old cues is worse than silence. The one exception is a
 * resume that completes at once, which is what happens inside a real
 * key press: that cue still plays.
 */
import { asset } from "@/app/_lib/asset-path";

export type UiSound = "select" | "selectA" | "back" | "pageLeft" | "pageRight" | "notification";

const SOUND_FILES: Record<UiSound, string> = {
  select: "13. Select.mp3",
  selectA: "10. Select A.mp3",
  back: "14. Back.mp3",
  pageLeft: "08. Page Left.mp3",
  pageRight: "09. Page Right.mp3",
  notification: "notification.mp3",
};

/** A cue whose resume takes longer than this was not in a gesture. It is dropped. */
const RESUME_GRACE_MS = 150;

/** The events that give a user activation, and thus can resume the context. */
const ACTIVATION_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

let context: AudioContext | null = null;
const buffers = new Map<UiSound, AudioBuffer>();
const loads = new Map<UiSound, Promise<void>>();
const playing = new Map<UiSound, AudioBufferSourceNode>();
/** The cues that did not decode. They play through an <audio> element instead. */
const fallbacks = new Map<UiSound, HTMLAudioElement>();

function audioContext(): AudioContext | null {
  if (!context && typeof AudioContext !== "undefined") context = new AudioContext();
  return context;
}

function soundUrl(name: UiSound) {
  return asset(encodeURI(`/assets/sounds/${SOUND_FILES[name]}`));
}

function load(name: UiSound, ctx: AudioContext) {
  let pending = loads.get(name);
  if (!pending) {
    pending = fetch(soundUrl(name))
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(name, buffer);
      })
      // A browser that cannot decode the file can still play it in an
      // <audio> element, late but not silent.
      .catch(() => {
        const el = new Audio(soundUrl(name));
        el.preload = "auto";
        fallbacks.set(name, el);
      });
    loads.set(name, pending);
  }
  return pending;
}

const resume = () => {
  if (context?.state === "suspended") void context.resume().catch(() => {});
};

/**
 * Decodes every cue, thus the first play does not wait for a fetch, and
 * resumes the context at the first user activation. Client only. It is
 * safe to call more than one time.
 */
export function preloadSounds() {
  if (typeof window === "undefined") return;
  const ctx = audioContext();
  if (!ctx) return;
  for (const name of Object.keys(SOUND_FILES) as UiSound[]) void load(name, ctx);
  // Capture, thus a handler that stops the event cannot hide it.
  for (const type of ACTIVATION_EVENTS) window.addEventListener(type, resume, { capture: true });
}

export function playSound(name: UiSound) {
  if (typeof window === "undefined") return;
  const ctx = audioContext();
  if (!ctx) return;
  const fallback = fallbacks.get(name);
  if (fallback) {
    fallback.currentTime = 0;
    void fallback.play().catch(() => {});
    return;
  }
  const buffer = buffers.get(name);
  if (!buffer) {
    void load(name, ctx);
    return;
  }
  if (ctx.state === "running") {
    start(ctx, name, buffer);
    return;
  }
  const askedAt = performance.now();
  void ctx
    .resume()
    .then(() => {
      if (performance.now() - askedAt < RESUME_GRACE_MS) start(ctx, name, buffer);
    })
    .catch(() => {});
}

function start(ctx: AudioContext, name: UiSound, buffer: AudioBuffer) {
  playing.get(name)?.stop();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => {
    if (playing.get(name) === source) playing.delete(name);
  };
  source.start();
  playing.set(name, source);
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
