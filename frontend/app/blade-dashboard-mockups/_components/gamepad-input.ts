/**
 * The controller half of the input model (DESIGN.md §8), as a pure
 * function: the state of the last frame and a snapshot of the pad in,
 * the new state and the actions to fire out. There is no DOM here, thus
 * the rules can be read (and tested) apart from the rAF loop that feeds
 * them (`use-gamepad.ts`).
 *
 * The Gamepad API gives levels, not events, so the function fires on an
 * edge: an action fires when its button goes from up to down, never on
 * each frame that it stays down.
 *
 * Directions come from the left stick or the D-pad and repeat while
 * held, because the keyboard does: no handler checks `e.repeat`, so a
 * held arrow walks the list on the OS key repeat. The buttons do not
 * repeat. A held B would peel off every screen in the stack, which the
 * OS repeat of Escape only does by accident.
 *
 * The stick is read as one digital direction, on its dominant axis. The
 * OS repeats only the last arrow that was pressed, so a diagonal on the
 * keyboard also moves in one direction at a time.
 */

export type Direction = "up" | "down" | "left" | "right";
export type InputAction = Direction | "a" | "b" | "x" | "y" | "lb" | "rb";

/** How far the stick must lean to press a direction. */
export const DEADZONE = 0.5;
/**
 * How far back the stick must come to release it. Lower than `DEADZONE`,
 * so a stick that rests near the threshold does not flicker on and off.
 */
export const RELEASE = 0.35;
/** The delay before a held direction repeats, and the interval after it. */
export const REPEAT_DELAY_MS = 300;
export const REPEAT_INTERVAL_MS = 100;

/** Button indices of the "standard" mapping. */
const BUTTONS: readonly (readonly [number, InputAction])[] = [
  [0, "a"],
  [1, "b"],
  [2, "x"],
  [3, "y"],
  [4, "lb"],
  [5, "rb"],
];

const DPAD: readonly (readonly [number, Direction])[] = [
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
];

/** What the loop reads from a `Gamepad` each frame. */
export interface GamepadSnapshot {
  axes: readonly number[];
  pressed: readonly boolean[];
}

export interface GamepadInputState {
  /** The direction the stick holds, after hysteresis. */
  stick: Direction | null;
  /** The direction that fires and repeats: the D-pad, else the stick. */
  held: Direction | null;
  /** The time at which `held` fires again. */
  nextRepeatAt: number;
  /** Which of `BUTTONS` were down on the last frame, by index. */
  buttons: readonly boolean[];
}

export const INITIAL_GAMEPAD_STATE: GamepadInputState = {
  stick: null,
  held: null,
  nextRepeatAt: 0,
  buttons: [],
};

export function stepGamepadInput(
  prev: GamepadInputState,
  snapshot: GamepadSnapshot,
  now: number,
): { state: GamepadInputState; actions: InputAction[] } {
  const actions: InputAction[] = [];

  const buttons = BUTTONS.map(([index]) => snapshot.pressed[index] === true);
  BUTTONS.forEach(([, action], i) => {
    if (buttons[i] && !prev.buttons[i]) actions.push(action);
  });

  const stick = stickDirection(prev.stick, snapshot.axes[0] ?? 0, snapshot.axes[1] ?? 0);
  const held = dpadDirection(prev.held, snapshot.pressed) ?? stick;

  let nextRepeatAt = prev.nextRepeatAt;
  if (held === null) {
    nextRepeatAt = 0;
  } else if (held !== prev.held) {
    actions.push(held);
    nextRepeatAt = now + REPEAT_DELAY_MS;
  } else if (now >= prev.nextRepeatAt) {
    actions.push(held);
    // From now and not from the last deadline: after a stall (a tab in
    // the background) a burst of catch-up repeats would jump the cursor.
    nextRepeatAt = now + REPEAT_INTERVAL_MS;
  }

  return { state: { stick, held, nextRepeatAt, buttons }, actions };
}

/**
 * The stick as one direction. A held direction stays until its axis
 * falls under `RELEASE`, or until the other axis passes `DEADZONE` and
 * leans further. A new direction needs `DEADZONE` on the dominant axis.
 * On the Y axis up is negative.
 */
function stickDirection(prev: Direction | null, x: number, y: number): Direction | null {
  if (prev !== null) {
    const along = prev === "up" ? -y : prev === "down" ? y : prev === "left" ? -x : x;
    const across = prev === "up" || prev === "down" ? x : y;
    const overtaken = Math.abs(across) > DEADZONE && Math.abs(across) > along;
    if (along > RELEASE && !overtaken) return prev;
  }
  if (Math.max(Math.abs(x), Math.abs(y)) <= DEADZONE) return null;
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? "left" : "right";
  return y < 0 ? "up" : "down";
}

/** The D-pad as one direction. With two arrows down, the one already held wins. */
function dpadDirection(prev: Direction | null, pressed: readonly boolean[]): Direction | null {
  const down = DPAD.filter(([index]) => pressed[index] === true).map(([, dir]) => dir);
  if (prev !== null && down.includes(prev)) return prev;
  return down[0] ?? null;
}
