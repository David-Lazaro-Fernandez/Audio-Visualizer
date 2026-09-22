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
 * The panel content of the open blade (DESIGN.md §1): the header band
 * with the section title, the body and the legend band. Each blade
 * declares one panel, and only the panel whose `blade` label is the open
 * blade renders. Thus the page can declare each blade, and the tabs and
 * the Left and Right keys select the panel on the screen.
 *
 * This layer is the same full-bleed box as the tab layer above it, z-10
 * against z-20. The bounds of the panel are internal padding from the
 * geometry of the open blade (§1.2) and not the box of the layer. Thus
 * both layers use one simple shape, and neither is cropped to a
 * sub-region. The padding glides with the panel at a blade change, and
 * the new content arrives after a short delay from the direction of the
 * move (§7.4: `blade-content-in`, with the offset `--blade-enter-x`).
 * Thus the user sees the chrome move first and the content arrive on it.
 *
 * The body is one keyboard column (`data-nav-list="column"`). Up and
 * Down move from the gamer picture, down the menu rows, to the Open Tray
 * at the bottom. A blade with no design yet declares a panel with no
 * children: it shows its title on an empty panel with each legend slot
 * dimmed (§7.2) and does not use the content of another blade.
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
  /** The `label` of the blade that owns this panel. */
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
