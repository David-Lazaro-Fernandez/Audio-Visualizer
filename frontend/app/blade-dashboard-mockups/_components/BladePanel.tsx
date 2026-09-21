"use client";

import { useBladeNav } from "./BladeNavContext";
import {
  BLADE_MOTION_MS,
  BLADE_MOTION_EASE,
  CONTENT_ENTER_PX,
  bladeTransition,
} from "./blade-motion";
import { BladeChromeBand } from "./BladeChromeBand";
import { ButtonLegendBar, type LegendButton } from "./ButtonLegendBar";
import { MenuBoundary } from "./MenuBoundary";

/**
 * The open blade's panel content (DESIGN.md §1): header band with the
 * section title, the body, and the legend band. One is declared per blade
 * and only the one whose `blade` label matches the open blade renders, so
 * the page can describe every blade up front while the tabs and Left/Right
 * decide which is on screen.
 *
 * The layer is the same full-bleed box as the tab layer above it (z-10 vs.
 * z-20) — the panel bounds are internal padding taken from the open
 * blade's geometry (§1.2), not the layer's own box, so both layers share
 * one simple shape instead of each being cropped to a sub-region. Padding
 * glides with the panel when the blade changes, and the freshly mounted
 * content lands a beat later from the direction of travel (§7.4:
 * `blade-content-in`, offset by `--blade-enter-x`), so the chrome is seen
 * moving first and the content settling onto it.
 *
 * The body is one keyboard column (`data-nav-list="column"`): Up/Down run
 * from the gamerpic, down the menu rows, and on to Open Tray at the
 * bottom. A blade that hasn't been built yet can be declared with no
 * children: it shows its title over an empty panel with every legend slot
 * dimmed (§7.2), rather than borrowing another blade's content.
 */
const IDLE_LEGEND: { left: LegendButton[]; right: LegendButton[] } = {
  left: [
    { label: "Y", letter: "Y", disabled: true },
    { label: "X", letter: "X", disabled: true },
  ],
  right: [
    { label: "B", letter: "B", disabled: true },
    { label: "A", letter: "A", disabled: true, sizePx: 28 },
  ],
};

export function BladePanel({
  blade,
  legend = IDLE_LEGEND,
  children,
}: {
  /** The `label` of the blade this panel belongs to. */
  blade: string;
  legend?: { left: LegendButton[]; right: LegendButton[] };
  children?: React.ReactNode;
}) {
  const { active, direction, geometry } = useBladeNav();
  if (active.label !== blade) return null;

  return (
    <MenuBoundary
      className="blade-motion absolute inset-0 z-10 flex flex-col overflow-hidden"
      style={{
        paddingLeft: `${geometry.leftPct}%`,
        paddingRight: `${geometry.rightInsetPct}%`,
        transition: bladeTransition("padding-left", "padding-right"),
      }}
    >
      <div
        className="blade-motion flex min-h-0 flex-1 flex-col"
        style={{
          "--blade-enter-x": `${direction * CONTENT_ENTER_PX}px`,
          animation: `blade-content-in ${BLADE_MOTION_MS}ms ${BLADE_MOTION_EASE} ${Math.round(BLADE_MOTION_MS / 3)}ms both`,
        } as React.CSSProperties}
      >
      <BladeChromeBand
        edge="top"
        className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          {active.title}
        </h1>
      </BladeChromeBand>

      <div
        data-nav-list="column"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 md:gap-6 md:px-8 md:py-6 lg:px-10 lg:py-8"
      >
        {children}
      </div>

      <BladeChromeBand
        edge="bottom"
        className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 md:px-8 md:pb-8 lg:px-10 lg:pb-10"
      >
        <ButtonLegendBar left={legend.left} right={legend.right} />
      </BladeChromeBand>
      </div>
    </MenuBoundary>
  );
}
