"use client";

import { useEffect, useState } from "react";
import { useRect } from "./useRect";
import { useMenuBoundary } from "./MenuBoundary";
import { placeMenuBox } from "./menu-box-placement";
import { MenuDetailBox } from "./MenuDetailBox";
import { isBackKey } from "./keys";
import { playSound } from "./sounds";

/**
 * DESIGN.md §6.2 List item (menu row): "small monochrome icon (left) +
 * label, separated by thin divider lines." Rendered as a real <button> so
 * it's hoverable/focusable, since these are navigable menu items. The
 * `button` variant is the doc's "prominent rows may be rendered as raised
 * buttons" case; `disabled` washes the row out per §7.2 ("disabled ≠
 * hidden") using the native disabled state instead of just dimming it.
 *
 * When `detail` is given, clicking the row opens a master-detail box
 * (§5.3) positioned via `placeMenuBox` against the measured menu boundary
 * — it renders beside the row, falls back to below it, or not at all if
 * neither fits the container.
 *
 * Sound: hovering a live row plays Select; opening its detail box plays
 * Select A; closing it (re-click, ×, or ESC/B) plays Back. Back keys are
 * only listened for while a box is open, so they're silent when there's
 * nothing to go back from.
 *
 * Keyboard: every row is a `data-nav-item` so `KeyboardNav` can step the
 * cursor through them with the arrows; `focus-visible` mirrors the hover
 * look so the cursor is visible. `autoFocus` puts the cursor here on load.
 */
export function MenuListItem({
  label,
  meta,
  variant = "row",
  disabled = false,
  detailTitle,
  detail,
  autoFocus = false,
  icon: customIcon,
  onHighlight,
}: {
  label: string;
  meta?: string;
  variant?: "row" | "button" | "brand";
  disabled?: boolean;
  detailTitle?: string;
  detail?: React.ReactNode;
  autoFocus?: boolean;
  /** Leading glyph (e.g. `<MenuIcon name="trophy" />`); falls back to a plain square. */
  icon?: React.ReactNode;
  /** Fires when the cursor lands here (hover or focus), e.g. to update a description pane. */
  onHighlight?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { ref, rect } = useRect<HTMLButtonElement>();
  const containerRect = useMenuBoundary();
  const expandable = Boolean(detail) && !disabled;
  const placement =
    expandable && open && rect && containerRect
      ? placeMenuBox(containerRect, rect)
      : null;

  const close = () => {
    playSound("back");
    setOpen(false);
  };

  const handleClick = () => {
    if (!expandable) return;
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      playSound("back");
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const icon = customIcon ?? (
    <div
      className={`h-6 w-6 shrink-0 rounded-[4px] ${variant === "button" ? "bg-[rgba(0,0,0,.22)]" : "bg-[rgba(0,0,0,.24)]"}`}
    />
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
        autoFocus={autoFocus}
        onMouseEnter={handleHover}
        onFocus={handleFocus}
        onClick={handleClick}
        className="flex w-full items-center gap-3.5 rounded-[10px] px-[13px] py-2.5 text-left transition hover:brightness-[1.03] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#379226] focus-visible:brightness-[1.03]"
        style={{
          background: "linear-gradient(180deg,#ffffff,#ffffff 46%,#e4e4e4)",
          boxShadow:
            "inset 0 1px 0 #fff,0 0 0 1px rgba(255,255,255,.8),0 4px 10px rgba(0,0,0,.14)",
        }}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-[23px] text-[#151515]">
          {label}
        </span>
        {meta && (
          <span className="shrink-0 text-[21px] text-[#3a3a3a]">{meta}</span>
        )}
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
        aria-expanded={expandable ? open : undefined}
        data-nav-item
        autoFocus={autoFocus}
        onMouseEnter={handleHover}
        onFocus={handleFocus}
        onClick={handleClick}
        className="flex w-full items-center gap-3.5 border-b-[3px] border-[#379226] px-[13px] py-[11px] text-left transition-colors duration-150 hover:bg-white/15 focus-visible:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-45"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-[23px] text-[#17300a]">
          {label}
        </span>
        {meta && (
          <span className="shrink-0 text-[20px] text-[#1f3b0d]">{meta}</span>
        )}
      </button>
    );
  }

  return (
    <>
      {row}
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
