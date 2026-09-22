"use client";

import { useEffect } from "react";
import { useBladeNav } from "./BladeNavContext";
import { isNativeButtonActivationKey, isSelectKey } from "./keys";
import { playSound } from "./sounds";

/**
 * The global D-pad of the dashboard. Mount it one time in
 * `BladeNavProvider`. It renders nothing.
 *
 * Left and Right switch blades (`BladeNavContext.step`) from each
 * position of the cursor. Games to media plays Page Right, and games to
 * community plays Page Left. There are two exceptions: while a modal
 * screen is open, and while the cursor is in a grid. In a grid the two
 * keys move in the grid.
 *
 * Up and Down move the cursor through a list. Mark a container with
 * `data-nav-list` and each focusable entry with `data-nav-item`:
 *   - "column", the default: Up and Down step one item.
 *   - a number N: a grid N wide. Left and Right step 1, and Up and Down
 *     step N.
 * The movement clamps at the ends and does not wrap. It plays the Select
 * sound and uses real focus, thus the `focus-visible` styles are also
 * the cursor.
 *
 * The A key clicks the focused item. The browser handles Space and
 * Enter, because the items are native <button>s and it already clicks
 * them. The one exception is a page with no focus, where Space would
 * scroll the page.
 *
 * This component does not handle Back (ESC or B). Each screen closes
 * itself with `isBackKey`, thus Back is silent when there is nothing to
 * close.
 */
export function KeyboardNav() {
  const { step } = useBladeNav();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditable(e.target)) return;

      const active = document.activeElement as HTMLElement | null;
      const item = active?.closest<HTMLElement>("[data-nav-item]") ?? null;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const list = item?.closest<HTMLElement>("[data-nav-list]") ?? null;
        if (!list || gridColumns(list) === 0) {
          e.preventDefault();
          // A modal, such as the gamer picture chooser, covers the
          // blades. Do not switch them below it.
          if (!isModalOpen()) step(e.key === "ArrowLeft" ? -1 : 1);
          return;
        }
      }

      if (ARROWS.has(e.key)) {
        e.preventDefault();
        moveCursor(item, e.key);
        return;
      }

      if (isSelectKey(e)) {
        // Space and Enter on a focused <button> already click it. Do
        // not click it a second time. This code clicks the other keys.
        if (isNativeButtonActivationKey(e) && active instanceof HTMLButtonElement) return;
        e.preventDefault();
        (item ?? (active instanceof HTMLButtonElement ? active : null))?.click();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [step]);

  return null;
}

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** The number of columns of a grid list. A plain column gives 0. */
function gridColumns(list: HTMLElement) {
  const cols = Number(list.dataset.navList);
  return Number.isInteger(cols) && cols > 0 ? cols : 0;
}

function isModalOpen() {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

function navItemsOf(list: HTMLElement) {
  return Array.from(list.querySelectorAll<HTMLElement>("[data-nav-item]")).filter(
    (el) => !el.matches(":disabled") && el.closest("[data-nav-list]") === list,
  );
}

function moveCursor(item: HTMLElement | null, key: string) {
  const list = item?.closest<HTMLElement>("[data-nav-list]") ?? null;

  if (!list || !item) {
    // No item of a list has focus. Put the cursor on the first item. A
    // list in an open dialog has priority, thus the modal keeps the
    // cursor.
    const first =
      document.querySelector<HTMLElement>(
        '[role="dialog"] [data-nav-list] [data-nav-item]:not(:disabled)',
      ) ??
      document.querySelector<HTMLElement>(
        "[data-nav-list] [data-nav-item]:not(:disabled)",
      );
    if (first) {
      first.focus();
      playSound("select");
    }
    return;
  }

  const cols = gridColumns(list);

  let delta = 0;
  switch (key) {
    case "ArrowUp":
      delta = cols ? -cols : -1;
      break;
    case "ArrowDown":
      delta = cols ? cols : 1;
      break;
    // Left and Right arrive here only in a grid. In the other lists they
    // switch blades.
    case "ArrowLeft":
      delta = -1;
      break;
    case "ArrowRight":
      delta = 1;
      break;
  }
  if (delta === 0) return;

  const items = navItemsOf(list);
  const index = items.indexOf(item);
  if (index === -1) return;
  const next = Math.min(items.length - 1, Math.max(0, index + delta));
  if (next === index) return;

  items[next].focus();
  playSound("select");
}
