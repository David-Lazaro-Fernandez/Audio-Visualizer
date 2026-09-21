"use client";

import { useEffect, useRef } from "react";
import { isBackKey } from "./keys";

/**
 * Back (ESC / B) for stacked surfaces. Screens nest — Games blade → Games
 * Library → My Games — and every open surface listens on `document`, so a
 * single ESC would otherwise close all of them at once. Each open surface
 * pushes a token here; only the one on top of the stack acts on Back, the
 * rest stay quiet until it has closed. Tokens are removed on close (or
 * unmount) by identity, so surfaces can close out of order safely.
 *
 * `onBack` is read through a ref so callers can pass a fresh closure every
 * render without re-registering (which would shuffle the stack order).
 */
const stack: symbol[] = [];

export function useBackKey(active: boolean, onBack: () => void) {
  const callback = useRef(onBack);
  useEffect(() => {
    callback.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    const token = Symbol("back-stack");
    stack.push(token);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      if (stack[stack.length - 1] !== token) return;
      callback.current();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = stack.indexOf(token);
      if (index !== -1) stack.splice(index, 1);
    };
  }, [active]);
}
