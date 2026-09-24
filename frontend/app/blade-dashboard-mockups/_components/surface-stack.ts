"use client";

import { useEffect, useState } from "react";

/**
 * Which full-screen surface is on top, thus which ones can stop
 * painting (DESIGN.md §5.4).
 *
 * The screens stack, and each one is its own portal with its own water
 * shader (§3.1). To reach the Music Player is to open five of them —
 * Music, Music Library, the album, the song, the player — above the
 * blade canvas, and each surface below the top one kept painting a full
 * viewport of water that nothing could see. Six WebGL2 contexts drawing
 * at once left the visualizer on the top screen the small part of a
 * frame that the hidden five did not take.
 *
 * A surface is opaque and covers the whole viewport, thus the one on
 * top is the only one with anything to show. The others hold their last
 * frame, which costs nothing and is what is already on the screen
 * behind the cover. They are correct again on the frame after the cover
 * closes, because the water is a function of the clock and not of the
 * frames that it drew.
 *
 * This is the stack of `back-stack.ts` in another form, and for the
 * same reason: only the layer on top answers. It stays a separate
 * module, because the two answer different questions. Back is a key and
 * belongs to the screen; a cover is any opaque layer, and the
 * visualizer of the Music Player is one without being a screen.
 */
const layers: symbol[] = [];
const listeners = new Set<() => void>();

/** A copy, thus a listener that unsubscribes here does not break the walk. */
const notify = () => {
  for (const listener of [...listeners]) listener();
};

/**
 * Whether an opaque layer hides `token`. A caller with no token of its
 * own is the floor, thus any layer at all covers it.
 */
function isCovered(token: symbol | null): boolean {
  if (!token) return layers.length > 0;
  const index = layers.indexOf(token);
  return index !== -1 && index < layers.length - 1;
}

/**
 * Reports whether the caller is hidden by an opaque layer above it.
 *
 * `opaque` registers the caller as one such layer for as long as it is
 * true. A full-screen surface passes `true`: it hides what is below and
 * can itself be hidden. The blade canvas passes `false`: it is the
 * floor and covers nothing. A layer that has no surface of its own,
 * such as the full-screen visualizer, passes `true` and ignores the
 * answer.
 *
 * The order of the array is the order of mount, which is the order of
 * the stack: a screen opens above the screen that opened it.
 */
export function useCoveredSurface(opaque: boolean): boolean {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const token = opaque ? Symbol("surface") : null;
    if (token) layers.push(token);
    const read = () => setCovered(isCovered(token));
    listeners.add(read);
    // Tell the others as well: this layer changed what covers them.
    notify();

    return () => {
      listeners.delete(read);
      if (token) {
        const index = layers.indexOf(token);
        if (index !== -1) layers.splice(index, 1);
      }
      setCovered(false);
      notify();
    };
  }, [opaque]);

  return covered;
}
