"use client";

import { useState } from "react";
import { useRect } from "./useRect";
import { useMenuBoundary } from "./MenuBoundary";
import { placeMenuBox } from "./menu-box-placement";
import { MenuDetailBox } from "./MenuDetailBox";
import { useBackKey } from "./back-stack";
import { playSound } from "./sounds";

/**
 * DESIGN.md §6.2 List item (menu row): "small monochrome icon (left) +
 * label, separated by thin divider lines." Rendered as a real <button> so
 * it's hoverable/focusable, since these are navigable menu items. The
 * `button` variant is the doc's "prominent rows may be rendered as raised
 * buttons" case; `disabled` washes the row out per §7.2 ("disabled ≠
 * hidden") using the native disabled state instead of just dimming it.
 * `unavailable` is the console's third state (§7.2): the row is faded like
 * a disabled one but stays a cursor stop, so the pane can explain why it
 * can't be used yet (the Music screen's "Music Player" row before a source
 * is chosen). It is `aria-disabled`, highlights and sounds like a live row,
 * and does nothing on Select.
 *
 * When `detail` is given, clicking the row opens a master-detail box
 * (§5.3) positioned via `placeMenuBox` against the measured menu boundary
 * — it renders beside the row, falls back to below it, or not at all if
 * neither fits the container. When `screen` is given instead, clicking
 * opens that component full-screen (e.g. the Games Library) and hands it
 * `onClose`; the row keeps owning the open/closed state and the Back key.
 *
 * Sound: hovering a live row plays Select; opening its detail box or
 * screen plays Select A; closing it (re-click, ×, or ESC/B) plays Back.
 * Back keys are only listened for while something is open, so they're
 * silent when there's nothing to go back from — and via `useBackKey` only
 * the topmost open surface answers, so ESC inside My Games doesn't also
 * close the Games Library underneath it.
 *
 * `chevron` (row variant) draws a small right-pointing triangle at the
 * row's end while the cursor is on it — the console's "there is a list to
 * the right of this" cue (Audiobooks' category rows). `compact` (button
 * variant) drops the empty top band so the raised skin is a single band
 * the height of its label: the item rows of a browse list (Audiobooks'
 * album list), where the two-band button would be too tall.
 *
 * Keyboard: every row is a `data-nav-item` so `KeyboardNav` can step the
 * cursor through them with the arrows; plain `focus` (not `focus-visible`)
 * mirrors the hover look so the cursor stays visible even when it was put
 * there by a mouse click or programmatically (e.g. a screen focusing its
 * first row on open). `autoFocus` puts the cursor here on load.
 */
export interface MenuScreenProps {
  onClose: () => void;
}

/*
 * Raised-button skin (the Games Library rows), stacked in two bands: an
 * empty top band that stays transparent so the blade green shows through,
 * and a bottom band that IS the row — icon + label on the left, value on
 * the right (space-between) — over a left-to-right gradient from
 * transparent to #ffffff63 (white at ~39%). The icon is taller than the band and pokes
 * up into the top one. A 1px #5a5a5a border plus an inner shadow on the
 * top, left and right edges only (three one-sided inset shadows: offset
 * toward the edge, negative spread so each stays on its own side; the
 * bottom edge is left clean) give the bevel. Cursor (hover / focus): the
 * whole button takes a left-to-right wash in pale grey #d9d9d9, transparent
 * at the left edge, 80% at the middle, 90% at three quarters and solid at
 * the right (Figma reference node 170:22), under the same bands and with
 * the same inner shadow. Like the list-row wash it sits on a `::before`
 * layer that fades in over 150 ms, since gradients can't interpolate;
 * `isolate` + `-z-10` keep it under the bands. Plain `focus` (not
 * `focus-visible`) so a mouse-clicked row stays lit like the console
 * cursor. Disabled: same shape, the border and band fade
 * (`group-disabled`) and the text drops to low-contrast green (§7.2).
 * Spelled out as full literal class strings because Tailwind only
 * generates what it can read verbatim.
 */
/** The raised skin's 1px border, shared with static surfaces like the My Games detail panel. */
export const RAISED_BORDER = "border border-[#5a5a5a]";
/** The raised skin's bevel: one-sided inset shadows on the top, left and right edges only. */
export const RAISED_INSET_SHADOW =
  "shadow-[inset_0_8px_8px_-4px_rgba(0,0,0,.2),inset_8px_0_8px_-4px_rgba(0,0,0,.2),inset_-8px_0_8px_-4px_rgba(0,0,0,.2)]";

// Kept as literals (not composed from the constants above) so Tailwind can
// see the hover:/focus:/disabled: variants verbatim.
const BUTTON_SKIN = [
  "group relative isolate overflow-hidden border border-[#5a5a5a] bg-transparent text-[#17300a]",
  "shadow-[inset_0_8px_8px_-4px_rgba(0,0,0,.2),inset_8px_0_8px_-4px_rgba(0,0,0,.2),inset_-8px_0_8px_-4px_rgba(0,0,0,.2)]",
  // Cursor wash (see the JSDoc above): fades in on a ::before layer.
  "before:pointer-events-none before:absolute before:inset-0 before:-z-10",
  "before:bg-[linear-gradient(90deg,rgba(217,217,217,0)_0%,rgba(217,217,217,.8)_50%,rgba(217,217,217,.9)_75%,rgba(217,217,217,1)_100%)]",
  "before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-100 focus:before:opacity-100",
  "hover:shadow-[inset_0_8px_8px_-4px_rgba(0,0,0,.2),inset_8px_0_8px_-4px_rgba(0,0,0,.2),inset_-8px_0_8px_-4px_rgba(0,0,0,.2)]",
  "focus:shadow-[inset_0_8px_8px_-4px_rgba(0,0,0,.2),inset_8px_0_8px_-4px_rgba(0,0,0,.2),inset_-8px_0_8px_-4px_rgba(0,0,0,.2)]",
  "focus:outline-none",
  "disabled:pointer-events-none disabled:border-[#5a5a5a]/50 disabled:text-[#8fd36a]",
  "disabled:shadow-[inset_0_8px_8px_-4px_rgba(0,0,0,.2),inset_8px_0_8px_-4px_rgba(0,0,0,.2),inset_-8px_0_8px_-4px_rgba(0,0,0,.2)]",
].join(" ");

const BUTTON_BAND =
  "flex w-full items-center justify-between gap-3.5 px-[14px] py-2 bg-[linear-gradient(90deg,#ffffff00_0%,#ffffff63_100%)] group-disabled:opacity-40";

/*
 * Row cursor (DESIGN.md §7.1): a horizontal light wash in pale grey
 * #d9d9d9, transparent at both ends and peaking at 50% just left of centre
 * (Figma reference node 166:13, with the peak raised from .4 to .5: stops
 * 0 → .2 → .3 → .5, mirrored). It lives
 * on a `::before` layer so it can fade in over the 150 ms tempo — gradients
 * themselves cannot interpolate. `isolate` + `-z-10` keep the layer under
 * the icon and label but above the row's own (transparent) background.
 */
const ROW_CURSOR_WASH = [
  "relative isolate before:pointer-events-none before:absolute before:inset-0 before:-z-10",
  "before:bg-[linear-gradient(90deg,rgba(217,217,217,0)_0%,rgba(217,217,217,.2)_23%,rgba(217,217,217,.3)_35%,rgba(217,217,217,.5)_46%,rgba(217,217,217,.3)_60%,rgba(217,217,217,.2)_73%,rgba(217,217,217,0)_100%)]",
  "before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-100 focus:before:opacity-100",
].join(" ");

export function MenuListItem({
  label,
  meta,
  variant = "row",
  disabled = false,
  unavailable = false,
  detailTitle,
  detail,
  screen: Screen,
  autoFocus = false,
  icon: customIcon,
  growOnFocus = false,
  iconOnly = false,
  chevron = false,
  compact = false,
  onHighlight,
  onSelect,
}: {
  label: string;
  meta?: string;
  variant?: "row" | "button" | "brand";
  disabled?: boolean;
  /** `row` variant: faded like `disabled` but still focusable and described; Select is a no-op. */
  unavailable?: boolean;
  detailTitle?: string;
  detail?: React.ReactNode;
  /** Full-screen component to open on select (takes precedence over `detail`). */
  screen?: React.ComponentType<MenuScreenProps>;
  autoFocus?: boolean;
  /**
   * Leading glyph (e.g. `<MenuIcon name="trophy" />`). Omitted falls back
   * to the placeholder square; an explicit `null` means no icon at all.
   */
  icon?: React.ReactNode | null;
  /**
   * `row` variant only: while the cursor is on the row (hover or focus), scale
   * the icon up and bump the label size, as the 360's game lists do — the
   * highlighted title swells out of the list. Off by default so the blade's
   * own menus keep their fixed rhythm.
   */
  growOnFocus?: boolean;
  /**
   * `row` variant only: draw just the (large) icon, centred, and keep the
   * label for assistive tech as the button's `aria-label` — the
   * Achievements screen's game filter is a column of title art with no
   * text. `meta` is not shown either.
   */
  iconOnly?: boolean;
  /** `row` variant only: a right-pointing triangle at the row's end while the cursor is on it. */
  chevron?: boolean;
  /** `button` variant only: single band, no empty top band — the compact skin of browse-list items. */
  compact?: boolean;
  /** Fires when the cursor lands here (hover or focus), e.g. to update a description pane. */
  onHighlight?: () => void;
  /**
   * Fires on select (click / Enter / Space / A) for rows that have neither a
   * `detail` box nor a `screen` — e.g. launching a game. Plays Select A.
   */
  onSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { ref, rect } = useRect<HTMLButtonElement>();
  const containerRect = useMenuBoundary();
  const expandable =
    (Boolean(detail) || Boolean(Screen)) && !disabled && !unavailable;
  const placement =
    expandable && !Screen && open && rect && containerRect
      ? placeMenuBox(containerRect, rect)
      : null;

  const close = () => {
    playSound("back");
    setOpen(false);
  };

  const handleClick = () => {
    if (!expandable) {
      if (onSelect && !disabled && !unavailable) {
        playSound("selectA");
        onSelect();
      }
      return;
    }
    if (open) {
      close();
    } else {
      playSound("selectA");
      setOpen(true);
    }
  };

  const handleHover = () => {
    if (disabled) return;
    playSound("select");
    onHighlight?.();
  };

  const handleFocus = () => {
    if (!disabled) onHighlight?.();
  };

  useBackKey(open, close);

  // An explicit `null` means the row has no icon at all, as the console's
  // track lists had none. Omitting the prop keeps the placeholder square,
  // which is what a row whose bitmap has not been redrawn wants (§6.2).
  const icon = customIcon === null ? null : (
    // Dim the glyph along with the text when disabled (the SVG icons carry
    // their own colours, so `color` alone wouldn't reach them). With
    // `growOnFocus` the glyph scales from its left edge so it swells toward
    // the label instead of into the row's padding.
    <span
      className={`flex shrink-0 ${disabled || unavailable ? "opacity-40" : ""} ${
        growOnFocus
          ? "origin-left transition-transform duration-150 group-hover:scale-150 group-focus:scale-150"
          : ""
      }`}
    >
      {customIcon ?? (
        <div
          className={`h-6 w-6 shrink-0 rounded-[4px] ${variant === "button" ? "bg-[rgba(0,0,0,.22)]" : "bg-[rgba(0,0,0,.24)]"}`}
        />
      )}
    </span>
  );

  const swirlIcon = (
    <div
      className="h-7 w-7 shrink-0 rounded-full"
      style={{
        background:
          "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.55) 0 2px, rgba(255,255,255,.08) 2px 5px)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)",
      }}
    />
  );

  let row: React.ReactNode;
  if (variant === "button") {
    row = (
      <button
        ref={expandable ? ref : undefined}
        type="button"
        aria-expanded={expandable ? open : undefined}
        data-nav-item
        disabled={disabled}
        autoFocus={autoFocus}
        onMouseEnter={handleHover}
        onFocus={handleFocus}
        onClick={handleClick}
        className={`flex w-full flex-col rounded-[10px] text-left transition-[background-color,border-color,box-shadow,color] duration-150 active:brightness-95 ${BUTTON_SKIN}`}
      >
        {/* empty top band (dropped by `compact`) */}
        {!compact && <span aria-hidden="true" className="block h-[26px] w-full" />}
        {/* bottom band: the row itself */}
        <span className={`${BUTTON_BAND} ${compact ? "py-[11px]" : ""}`}>
          <span className="flex min-w-0 items-center gap-3.5">
            {/* Icon is scaled up past the band and shifted upward so it
                straddles the split; the fixed-height wrapper keeps the
                oversized glyph from stretching the band. */}
            {icon && (
              <span className="flex h-6 shrink-0 items-center [&_svg]:h-11 [&_svg]:w-11 [&_svg]:-translate-y-[10px]">
                {icon}
              </span>
            )}
            <span className="min-w-0 truncate text-[23px]">{label}</span>
          </span>
          {meta && <span className="shrink-0 text-[22px]">{meta}</span>}
        </span>
      </button>
    );
  } else if (variant === "brand") {
    row = (
      <button
        type="button"
        data-nav-item
        autoFocus={autoFocus}
        onMouseEnter={handleHover}
        onFocus={handleFocus}
        onClick={handleClick}
        className="flex w-full items-center gap-3.5 rounded-[10px] px-[13px] py-2.5 text-left transition hover:brightness-[1.05] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 focus-visible:brightness-[1.05]"
        style={{
          background: "linear-gradient(180deg,#4a4a4a,#2c2c2c 60%,#1c1c1c)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.25),0 0 0 2px rgba(255,255,255,.5),0 4px 10px rgba(0,0,0,.35)",
        }}
      >
        {swirlIcon}
        <span className="min-w-0 flex-1 truncate text-[26px] leading-none font-bold tracking-tight">
          <span className="text-[#8bc93e]">XBOX</span>{" "}
          <span className="text-[#e2701f]">LIVE</span>
        </span>
      </button>
    );
  } else {
    row = (
      <button
        ref={expandable ? ref : undefined}
        type="button"
        disabled={disabled}
        aria-disabled={unavailable || undefined}
        aria-expanded={expandable ? open : undefined}
        aria-label={iconOnly ? label : undefined}
        data-nav-item
        autoFocus={autoFocus}
        onMouseEnter={handleHover}
        onFocus={handleFocus}
        onClick={handleClick}
        // Text and divider tints come from the blade's theme variables
        // (DESIGN.md §2.2, `blade-theme.ts`) so the same row sits on any
        // section color.
        className={`group flex w-full items-center gap-3.5 border-b-[3px] border-(--blade-rule) px-[13px] py-[11px] text-left transition-colors duration-150 focus:outline-none disabled:pointer-events-none disabled:opacity-45 ${ROW_CURSOR_WASH} ${
          growOnFocus ? "hover:gap-7 focus:gap-7" : ""
        } ${iconOnly ? "justify-center" : ""}`}
      >
        {icon}
        {!iconOnly && (
          <span
            className={`min-w-0 flex-1 truncate text-[23px] text-(--blade-ink) ${
              unavailable ? "opacity-45" : ""
            } ${
              growOnFocus
                ? "transition-[font-size] duration-150 group-hover:text-[30px] group-focus:text-[30px]"
                : ""
            }`}
          >
            {label}
          </span>
        )}
        {!iconOnly && meta && (
          <span className="shrink-0 text-[20px] text-(--blade-ink-soft)">{meta}</span>
        )}
        {!iconOnly && chevron && (
          // CSS-shape triangle like the Open Tray eject mark (§6.6), in the
          // glyph tint; fades in with the wash so it reads as part of the cursor.
          <span
            aria-hidden="true"
            className="block h-0 w-0 shrink-0 border-y-[9px] border-l-[11px] border-y-transparent border-l-(--blade-glyph) opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
          />
        )}
      </button>
    );
  }

  return (
    <>
      {row}
      {Screen && open && <Screen onClose={close} />}
      {placement && (
        <MenuDetailBox
          placement={placement}
          title={detailTitle ?? label}
          onClose={close}
        >
          {detail}
        </MenuDetailBox>
      )}
    </>
  );
}
