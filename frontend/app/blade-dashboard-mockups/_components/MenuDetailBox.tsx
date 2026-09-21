"use client";

import { createPortal } from "react-dom";
import type { BoxPlacement } from "./menu-box-placement";
import { getPortalRoot } from "./portal";

/**
 * The "box of content" a menu item opens on click (DESIGN.md §5.3
 * master-detail). Positioned in viewport coordinates from `placeMenuBox`,
 * clamped to the space actually available inside the main container.
 */
export function MenuDetailBox({
  placement,
  title,
  onClose,
  children,
}: {
  placement: BoxPlacement;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      className="fixed z-30 flex flex-col gap-2 overflow-auto rounded-[10px] p-4 text-[#151515]"
      style={{
        top: placement.top,
        left: placement.left,
        width: placement.maxWidth,
        maxHeight: placement.maxHeight,
        background: "linear-gradient(180deg,#ffffff,#f2f2f2 52%,#dcdcdc)",
        boxShadow:
          "inset 0 1px 0 #fff,0 0 0 1px rgba(255,255,255,.7),0 8px 18px rgba(0,0,0,.28)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[19px] font-semibold">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-[18px] leading-none text-[#5a5a5a] hover:text-black"
        >
          ×
        </button>
      </div>
      <div className="text-[15px] text-[#3a3a3a]">{children}</div>
    </div>,
    getPortalRoot(),
  );
}
