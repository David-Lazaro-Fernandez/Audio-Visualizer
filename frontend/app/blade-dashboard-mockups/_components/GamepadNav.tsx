"use client";

import { useCallback, useState } from "react";
import { ControllerNotification } from "./ControllerNotification";
import type { InputAction } from "./gamepad-input";
import { PROFILE } from "./profile";
import { useGamepad } from "./use-gamepad";

/**
 * The controller as a keyboard (DESIGN.md §8). Mount it one time, next
 * to `KeyboardNav`. It renders nothing, except the sign-in toast
 * (§6.17) for a few seconds after a pad connects.
 *
 * Each action becomes a `keydown` of the key that `keys.ts` binds to the
 * same button, sent to the focused element. This is a synthetic event
 * on purpose, and not a layer of actions that the screens listen to.
 * The key handlers decide who answers from where the event is on its
 * way up the DOM: a screen's `onKeyDown` takes Left or Right when the
 * cursor is in its column and calls `preventDefault()`, and
 * `KeyboardNav` on `document` then ignores the key. A layer of actions
 * would have to copy that bubbling and that order into each of the
 * eight handlers. A real event on the focused element gets it for free,
 * and the controller cannot drift from the keyboard.
 *
 * A is sent as "a" and not as Enter: a synthetic Enter is not trusted,
 * so the browser does not click the button, while "a" is clicked by
 * `KeyboardNav` itself.
 *
 * Each connect mounts a new toast (the key is a counter), thus a second
 * pad starts the toast again and does not extend the old one.
 */
export function GamepadNav() {
  const [toast, setToast] = useState<{ key: number; player: number } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useGamepad(
    (action) => {
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key: KEY_OF[action], bubbles: true, cancelable: true }),
      );
    },
    (pad) => {
      setToast((prev) => ({ key: (prev?.key ?? 0) + 1, player: pad.index }));
    },
  );

  if (!toast) return null;
  return (
    <ControllerNotification
      key={toast.key}
      gamertag={PROFILE.gamertag}
      player={toast.player}
      onDone={clearToast}
    />
  );
}

const KEY_OF: Record<InputAction, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  a: "a",
  b: "b",
  x: "x",
  y: "y",
  lb: "1",
  rb: "2",
};
