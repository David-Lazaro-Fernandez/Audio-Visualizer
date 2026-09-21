"use client";

import { useEffect } from "react";
import { useBladeNav } from "./BladeNavContext";
import { isNativeButtonActivationKey, isSelectKey } from "./keys";
import { playSound } from "./sounds";

/**
 * Global D-pad for the dashboard. Mount it once inside `BladeNavProvider`;
 * it renders nothing.
 *
 * Left/Right switch blades (`BladeNavContext.step`) from wherever the
 * cursor is — games → media plays Page Right, games → community plays Page
 * Left — except while a modal screen is open or the cursor is inside a
 * grid, where they move within the grid instead.
 *
 * Up/Down move the cursor through lists. Mark a container with
 * `data-nav-list` and its focusable entries with `data-nav-item`:
 *   - "column" (default): Up/Down step through items.
 *   - a number N: a grid N wide — Left/Right step 1, Up/Down step N.
 * Movement is clamped at the ends (no wrap), plays the Select blip, and
 * uses real focus so `focus-visible` styles double as the cursor.
 *
 * A (the key) clicks the focused item. Space and Enter are left to the
 * browser — the items are native <button>s, so it already clicks them —
 * except when nothing is focused, where Space would scroll the page instead.
 * Back (ESC/B)
 * is deliberately NOT handled here: each screen closes itself via
 * `isBackKey`, so Back is silent when there's nothing to leave.
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
          // A modal (the gamerpic chooser) covers the blades; don't flip
          // them underneath it.
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
        // Space/Enter on a focused <button> already click natively; don't
        // double-fire them. Everything else we click ourselves.
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

/** Column count for grid lists; 0 for plain columns. */
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
    // Nothing on a list has focus yet: drop the cursor onto the first item,
    // preferring a list inside an open dialog so the modal keeps priority.
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
    // Left/Right only reach here inside a grid; elsewhere they switch blades.
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
