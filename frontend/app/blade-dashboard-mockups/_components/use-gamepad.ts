"use client";

import { useEffect, useRef } from "react";
import {
  INITIAL_GAMEPAD_STATE,
  stepGamepadInput,
  type GamepadInputState,
  type InputAction,
} from "./gamepad-input";

/**
 * Reads the first connected controller and calls `onAction` for each
 * action that `stepGamepadInput` fires (DESIGN.md §8).
 *
 * The Gamepad API has no event for a button, so a rAF loop polls it. The
 * loop runs only while a pad is connected, and it asks
 * `navigator.getGamepads()` again each frame: in Chrome the `Gamepad`
 * object is a snapshot, and a kept reference never changes.
 *
 * Chrome does not show a pad to the page until a button is pressed on
 * it. Thus `gamepadconnected` can arrive some time after the pad is
 * paired, and the code also checks for a pad that is already there at
 * mount.
 *
 * A pad without the "standard" mapping (Firefox on macOS can give one)
 * logs a warning and is ignored: its indices mean something else, and a
 * guess would press the wrong buttons.
 *
 * `onConnect` is called when the browser shows a pad to the page, with
 * the `gamepadconnected` event. It is not called for a pad that is
 * already there at mount: that pad was announced on an earlier page.
 *
 * The code reads the callbacks through refs, thus a caller can pass new
 * closures at each render and the loop does not restart.
 */
export function useGamepad(
  onAction: (action: InputAction) => void,
  onConnect?: (pad: Gamepad) => void,
) {
  const callback = useRef(onAction);
  const connectCallback = useRef(onConnect);
  useEffect(() => {
    callback.current = onAction;
    connectCallback.current = onConnect;
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("getGamepads" in navigator)) return;

    let frame = 0;
    let state: GamepadInputState = INITIAL_GAMEPAD_STATE;
    const warned = new Set<string>();

    const firstPad = () => {
      for (const pad of navigator.getGamepads()) {
        if (pad && pad.connected) return pad;
      }
      return null;
    };

    const tick = (now: number) => {
      const pad = firstPad();
      if (!pad) {
        frame = 0;
        state = INITIAL_GAMEPAD_STATE;
        return;
      }
      frame = requestAnimationFrame(tick);

      if (pad.mapping !== "standard") {
        if (!warned.has(pad.id)) {
          warned.add(pad.id);
          console.warn(`Gamepad "${pad.id}" has no standard mapping. It is ignored.`);
        }
        state = INITIAL_GAMEPAD_STATE;
        return;
      }

      const result = stepGamepadInput(
        state,
        { axes: pad.axes, pressed: pad.buttons.map((button) => button.pressed) },
        now,
      );
      state = result.state;
      for (const action of result.actions) callback.current(action);
    };

    const start = () => {
      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    const onConnected = (e: GamepadEvent) => {
      console.info(`Gamepad connected: ${e.gamepad.id}`);
      connectCallback.current?.(e.gamepad);
      start();
    };
    // The loop stops by itself when no pad is left. This only resets the
    // state, so a button that was down at the disconnect does not count
    // as held when a pad comes back.
    const onDisconnected = (e: GamepadEvent) => {
      console.info(`Gamepad disconnected: ${e.gamepad.id}`);
      state = INITIAL_GAMEPAD_STATE;
    };

    window.addEventListener("gamepadconnected", onConnected);
    window.addEventListener("gamepaddisconnected", onDisconnected);
    if (firstPad()) start();

    return () => {
      window.removeEventListener("gamepadconnected", onConnected);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
      cancelAnimationFrame(frame);
      frame = 0;
    };
  }, []);
}
