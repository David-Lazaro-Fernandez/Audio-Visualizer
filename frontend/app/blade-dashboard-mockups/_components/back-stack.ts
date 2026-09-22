"use client";

import { useEffect, useRef } from "react";
import { isBackKey } from "./keys";

/**
 * Back (ESC or B) for stacked surfaces. The screens nest, for example
 * the Games blade, then the Games Library, then My Games. Each open
 * surface listens on `document`, thus one ESC would close all of them.
 * To prevent this, each open surface pushes a token here. Only the token
 * at the top of the stack answers Back, and the others stay quiet until
 * it closes. The code removes a token by identity at a close or an
 * unmount, thus the surfaces can close in any order.
 *
 * The code reads `onBack` through a ref. Thus a caller can pass a new
 * closure at each render and does not register again, which would change
 * the order of the stack.
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
