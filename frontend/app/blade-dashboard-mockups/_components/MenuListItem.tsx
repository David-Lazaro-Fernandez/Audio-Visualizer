"use client";

import { useState } from "react";
import { useRect } from "./useRect";
import { useMenuBoundary } from "./MenuBoundary";
import { placeMenuBox } from "./menu-box-placement";
import { MenuDetailBox } from "./MenuDetailBox";
import { useBackKey } from "./back-stack";
import { playSound } from "./sounds";

/**
 * The list item, or menu row, of DESIGN.md §6.2: a small monochrome icon
 * on the left with a label, and thin divider lines between the rows. It
 * is a real <button>, thus it takes hover and focus, because these are
 * navigable menu items.
 *
 * The `button` variant is the raised button of the design guide. The
 * `disabled` variant fades the row as §7.2 requires, disabled is not
 * hidden, and it uses the native disabled state and not only a dim
 * class. The `unavailable` variant is the third state of the console
 * (§7.2): the row fades as a disabled row does, but it stays a cursor
 * stop, thus the pane can explain why the row is not usable yet. The
 * Music Player row of the Music screen uses it before a user selects a
 * source. Such a row is `aria-disabled`, it highlights and sounds as a
 * live row, and Select does nothing on it.
 *
 * With `detail`, a click on the row opens a master-detail box (§5.3).
 * `placeMenuBox` positions the box against the measured menu boundary:
 * beside the row, else below the row, else not at all if the container
 * is too small. With `screen`, a click opens that component full-screen,
 * such as the Games Library, and gives it `onClose`. The row keeps the
 * open state and the Back key.
 *
 * Sound: a hover on a live row plays Select. An open of its detail box
 * or its screen plays Select A. A close, by a second click, by the ×, or
 * by ESC or B, plays Back. The code listens for a Back key only while
 * something is open, thus there is no sound when there is nothing to
 * close. Also, with `useBackKey` only the topmost open surface answers,
 * thus ESC in My Games does not also close the Games Library below it.
 *
 * `chevron`, on the row variant, draws a small right-pointing triangle
 * at the end of the row while the cursor is on it. This is the cue of
 * the console for a list to the right, as on the category rows of Music
 * Library. `compact`, on the button variant, removes the empty top
 * band, thus the raised skin is one band at the height of its label.
 * The item rows of a browse list use it, such as the album list of
 * Music Library, where the two-band button is too tall.
 *
 * `subtitle`, on the row variant, stacks a second, softer line under the
 * label instead of the single-line row every other menu uses. The
 * Spotlight screen's list (DESIGN.md §6.20) needs it because a
 * Marketplace item is named by its content type ("Game", "Downloaded
 * Content", …) and not by a value at the end of the row, so `meta` does
 * not fit.
 *
 * Keyboard: each row is a `data-nav-item`, thus `KeyboardNav` can move
 * the cursor through the rows with the arrow keys. The row uses plain
 * `focus` and not `focus-visible`, thus the cursor looks the same as a
 * hover and stays visible after a mouse click or after code moves it,
 * as a screen does when it focuses its first row. `autoFocus` puts the
 * cursor on the row at load.
 */
export interface MenuScreenProps {
  onClose: () => void;
  /**
   * True once a close has been requested (a second click, ESC/B, or a
   * backdrop click) but before the row actually unmounts the screen.
   * Only set for a screen whose component declares its own
   * `EXIT_ANIMATION_MS` (the Sign In drawer, DESIGN.md §6.22): every
   * other screen still unmounts the instant `onClose` runs, exactly as
   * before, and never sees this prop turn `true`. A screen that reads it
   * can play an exit animation for that many ms while it stays mounted.
   */
  closing?: boolean;
}

/*
 * The raised-button skin, used by the Games Library rows. It has two
 * bands. The top band is empty and transparent, thus the blade green
 * shows through. The bottom band is the row: the icon and the label on
 * the left and the value on the right, with `space-between`, over a
 * left-to-right gradient from transparent to #ffffff63, which is white
 * at near 39%. The icon is taller than the band and goes up into the top
 * band.
 *
 * The bevel is a 1 px #5a5a5a border plus an inner shadow on the top,
 * the left and the right edges only. There are three one-sided inset
 * shadows: each one has an offset toward its edge and a negative spread,
 * thus each stays on its own side. The bottom edge stays clean.
 *
 * The cursor, which is a hover or a focus, gives the full button a
 * left-to-right wash in pale grey #d9d9d9: transparent at the left edge,
 * 80% at the middle, 90% at three quarters and solid at the right (Figma
 * reference node 170:22). The wash goes under the same bands and takes
 * the same inner shadow. As with the wash of a list row, it is on a
 * `::before` layer that fades in across 150 ms, because a gradient
 * cannot interpolate. `isolate` and `-z-10` keep the layer under the
 * bands. The row uses plain `focus` and not `focus-visible`, thus a row
 * that a mouse clicked stays lit, as the cursor of the console does.
 *
 * The label takes the ink of the section (§2.2), thus the same skin
 * works on the Marketplace blade and on the full-screen menus.
 *
 * A disabled row keeps the same shape. Its border and its band fade
 * (`group-disabled`) and its text becomes the low-contrast green (§7.2).
 *
 * The classes are full literal strings, because Tailwind generates only
 * what it can read verbatim.
 */
/** The 1 px border of the raised skin. Static surfaces such as the My Games detail panel also use it. */
export const RAISED_BORDER = "border border-[#5a5a5a]";
/** The bevel of the raised skin: one-sided inset shadows on the top, the left and the right edges only. */
export const RAISED_INSET_SHADOW =
  "shadow-[inset_0_8px_8px_-4px_rgba(0,0,0,.2),inset_8px_0_8px_-4px_rgba(0,0,0,.2),inset_-8px_0_8px_-4px_rgba(0,0,0,.2)]";

// These are literals and not compositions of the constants above, thus
// Tailwind can read the hover:, focus: and disabled: variants verbatim.
const BUTTON_SKIN = [
  "group relative isolate overflow-hidden border border-[#5a5a5a] bg-transparent text-(--blade-ink)",
  "shadow-[inset_0_8px_8px_-4px_rgba(0,0,0,.2),inset_8px_0_8px_-4px_rgba(0,0,0,.2),inset_-8px_0_8px_-4px_rgba(0,0,0,.2)]",
  // The cursor wash. It fades in on a ::before layer. Refer to the JSDoc above.
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
 * The row cursor (DESIGN.md §7.1): a horizontal light wash in pale grey
 * #d9d9d9. It is transparent at the two ends and its peak is 50%, a
 * short distance left of the centre (Figma reference node 166:13, with
 * the peak raised from .4 to .5: the stops are 0, .2, .3 and .5, then
 * mirrored). The wash is on a `::before` layer, thus it can fade in
 * across the 150 ms tempo, because a gradient cannot interpolate.
 * `isolate` and `-z-10` keep the layer below the icon and the label and
 * above the transparent background of the row.
 */
const ROW_CURSOR_WASH = [
  "relative isolate before:pointer-events-none before:absolute before:inset-0 before:-z-10",
  "before:bg-[linear-gradient(90deg,rgba(217,217,217,0)_0%,rgba(217,217,217,.2)_23%,rgba(217,217,217,.3)_35%,rgba(217,217,217,.5)_46%,rgba(217,217,217,.3)_60%,rgba(217,217,217,.2)_73%,rgba(217,217,217,0)_100%)]",
  "before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-100 focus:before:opacity-100",
].join(" ");

export function MenuListItem({
  label,
  meta,
  subtitle,
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
  compactLarge = false,
  onHighlight,
  onSelect,
}: {
  label: string;
  meta?: string;
  /** `row` variant only: a second, softer line under the label, in place of the single-line label. */
  subtitle?: string;
  variant?: "row" | "button" | "brand";
  disabled?: boolean;
  /** `row` variant: faded as `disabled` is, but focusable and described. Select does nothing. */
  unavailable?: boolean;
  detailTitle?: string;
  detail?: React.ReactNode;
  /** The full-screen component that Select opens. It has priority over `detail`. */
  screen?: React.ComponentType<MenuScreenProps>;
  autoFocus?: boolean;
  /**
   * The glyph at the start of the row, such as `<MenuIcon name="trophy" />`.
   * With no value the row shows the placeholder square. An explicit
   * `null` means that the row has no icon.
   */
  icon?: React.ReactNode | null;
  /**
   * `row` variant only. While the cursor is on the row, by a hover or a
   * focus, the icon becomes larger and the label size increases, as in
   * the game lists of the console: the highlighted title swells out of
   * the list. It is off by default, thus the menus of the blade keep
   * their constant rhythm.
   */
  growOnFocus?: boolean;
  /**
   * `row` variant only. The row draws only the large icon, centred, and
   * keeps the label for assistive technology as the `aria-label` of the
   * button. The game filter of the Achievements screen is a column of
   * title art with no text. The row also does not show `meta`.
   */
  iconOnly?: boolean;
  /** `row` variant only: a right-pointing triangle at the end of the row while the cursor is on it. */
  chevron?: boolean;
  /** `button` variant only: one band and no empty top band. This is the compact skin of a browse-list item. */
  compact?: boolean;
  /** `compact` only: a bigger icon and a taller band, for a handful of tiles rather than a browse list stacked a dozen deep. */
  compactLarge?: boolean;
  /** Called when the cursor arrives, by a hover or a focus. It can update a description pane. */
  onHighlight?: () => void;
  /**
   * Called on a select, which is a click, Enter, Space or A, for a row
   * that has no `detail` box and no `screen`. A row that launches a game
   * uses it. It plays Select A.
   */
  onSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const { ref, rect } = useRect<HTMLButtonElement>();
  const containerRect = useMenuBoundary();
  const expandable =
    (Boolean(detail) || Boolean(Screen)) && !disabled && !unavailable;
  const placement =
    expandable && !Screen && open && rect && containerRect
      ? placeMenuBox(containerRect, rect)
      : null;
  // A screen opts into a delayed close by declaring how long its own
  // exit animation runs (the Sign In drawer, DESIGN.md §6.22). Every
  // other screen leaves this unset, so `close` still unmounts it the
  // instant it runs, exactly as before.
  const exitAnimationMs =
    (Screen as { EXIT_ANIMATION_MS?: number } | undefined)?.EXIT_ANIMATION_MS ?? 0;

  const close = () => {
    if (closing) return;
    playSound("back");
    if (exitAnimationMs > 0) {
      setClosing(true);
      window.setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, exitAnimationMs);
    } else {
      setOpen(false);
    }
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

  // An explicit `null` means that the row has no icon, as the track
  // lists of the console had none. With no prop the row keeps the
  // placeholder square, which a row with a bitmap that is not redrawn
  // yet needs (§6.2).
  const icon = customIcon === null ? null : (
    // Fade the glyph with the text on a disabled row. The SVG icons have
    // their own colours, thus `color` alone does not change them. With
    // `growOnFocus` the glyph scales from its left edge, thus it grows
    // toward the label and not into the padding of the row.
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
        {/* The empty top band. `compact` removes it. */}
        {!compact && <span aria-hidden="true" className="block h-[26px] w-full" />}
        {/* The bottom band, which is the row. `compactLarge` widens the
            band's own padding to match its bigger icon. */}
        <span
          className={`${BUTTON_BAND} ${
            compact ? (compactLarge ? "py-[18px]" : "py-[11px]") : ""
          }`}
        >
          <span className="flex min-w-0 items-center justify-start gap-3.5">
            {/* The icon is larger than the band and moves up, thus it
                crosses the split between the two bands. The wrapper has a
                fixed height, thus the large glyph does not stretch the
                band. `compact` has no top band to cross, so its icon
                stays at its own size and centers on the label instead;
                `compactLarge` steps that size up for a handful of tiles
                rather than a browse list stacked a dozen deep. */}
            {icon && (
              <span
                className={`flex h-6 shrink-0 items-center justify-start ${
                  compact
                    ? compactLarge
                      ? "[&_svg]:h-8 [&_svg]:w-8"
                      : "[&_svg]:h-6 [&_svg]:w-6"
                    : "[&_svg]:h-11 [&_svg]:w-11 [&_svg]:-translate-y-[10px]"
                }`}
              >
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
        // The text tint and the divider tint come from the theme
        // variables of the blade (DESIGN.md §2.2, `blade-theme.ts`),
        // thus the same row works on each section colour.
        className={`group flex w-full items-center gap-3.5 border-b-[3px] border-(--blade-rule) px-[13px] py-[11px] text-left transition-colors duration-150 focus:outline-none disabled:pointer-events-none disabled:opacity-45 ${ROW_CURSOR_WASH} ${
          growOnFocus ? "hover:gap-7 focus:gap-7" : ""
        } ${iconOnly ? "justify-center" : ""}`}
      >
        {icon}
        {!iconOnly && subtitle ? (
          <span className={`flex min-w-0 flex-1 flex-col ${unavailable ? "opacity-45" : ""}`}>
            <span className="truncate text-[23px] text-(--blade-ink)">{label}</span>
            <span className="truncate text-[20px] text-(--blade-ink-soft)">{subtitle}</span>
          </span>
        ) : (
          !iconOnly && (
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
          )
        )}
        {!iconOnly && meta && (
          <span className="shrink-0 text-[20px] text-(--blade-ink-soft)">{meta}</span>
        )}
        {!iconOnly && chevron && (
          // A CSS-shape triangle, as the eject mark of the Open Tray
          // (§6.6), in the glyph tint. It fades in with the wash, thus it
          // is part of the cursor.
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
      {Screen && open && <Screen onClose={close} closing={closing} />}
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
