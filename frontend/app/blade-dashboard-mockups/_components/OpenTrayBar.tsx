"use client";

import { playSound } from "./sounds";

/**
 * DESIGN.md §1 blade anatomy: the wide pill bar anchored near the bottom
 * of the active blade's left column. It's an action, so it's a <button>
 * with a hover/active state rather than inert markup. The eject glyph is
 * a left-pointing triangle + a thin 3px bar (CSS shapes, not an icon font)
 * sitting inside a circle that overlaps the pill's rounded left cap.
 *
 * The circle is a sibling of the button (it has to sit behind the pill's
 * cap), so hover is tracked on the shared wrapper (`group`): hovering or
 * keyboard-focusing the pill tints both the pill and the circle, and
 * brightens the eject glyph, so the whole control reads as one item.
 *
 * The label and the eject glyph take their tints from the blade's theme
 * variables (DESIGN.md §2.2), so the same bar sits on the green Games
 * blade and the gold Xbox LIVE one.
 */
export function OpenTrayBar({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className="group relative"
      style={{ marginTop: "140px", width: "100%", maxWidth: "100%" }}
    >
      <button
        type="button"
        data-nav-item
        onMouseEnter={() => playSound("select")}
        className={`box-border flex translate-x-3 items-center rounded-full py-3.5 pr-6 pl-[76px] transition-colors duration-150 group-hover:bg-white/15 group-active:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 ${className ?? ""}`}
        style={{
          width: "100%",
          maxWidth: "100%",
          boxShadow: "rgba(0, 0, 0, 0.35) 0px 0px 8px 2px inset",
        }}
      >
        <span className="text-[23px] text-(--blade-ink)">{label}</span>
      </button>
      <div
        className="absolute top-1/2 left-0 flex h-[84px] w-[84px] -translate-x-2 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-150 group-hover:bg-white/15 group-focus-within:bg-white/15"
        style={{
          zIndex: -5,
          border: "solid var(--blade-glyph) 0.1px",
          boxShadow: "rgba(0, 0, 0, 0.35) 0px 0px 8px 2px inset",
        }}
      >
        <span className="flex items-center gap-[3px]">
          <span className="h-0 w-0 border-y-[7px] border-r-[10px] border-y-transparent border-r-(--blade-glyph) transition-colors duration-150 group-hover:border-r-(--blade-glyph-hover) group-focus-within:border-r-(--blade-glyph-hover)" />
          <span className="h-[14px] w-[3px] bg-(--blade-glyph) transition-colors duration-150 group-hover:bg-(--blade-glyph-hover) group-focus-within:bg-(--blade-glyph-hover)" />
        </span>
      </div>
    </div>
  );
}
