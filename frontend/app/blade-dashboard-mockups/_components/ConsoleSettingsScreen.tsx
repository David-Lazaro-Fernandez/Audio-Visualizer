"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, SYSTEM_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { SYSTEM_THEME, themeVars } from "./blade-theme";
import {
  LibraryMenu,
  LibraryMenuProvider,
  useHighlightedItem,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { getPortalRoot } from "./portal";

/**
 * The Console Settings screen, which the Console Settings row of the
 * System blade opens (DESIGN.md §6.18).
 *
 * It has the same full-screen structure as the song screen (§6.15), on
 * the purple of the System blade: the header band with the title, the
 * content raised as one slab, two columns, and a legend of Y and X
 * dimmed, Back B and Select A. The portal root is outside the canvas,
 * thus the screen sets the system theme on its own root.
 *
 * The left column is the list of settings as blade rows with no icon
 * (`icon={null}`), as the console drew it. The right column is the pane
 * of the highlighted row: a "Current Setting" heading over the current
 * values, then a blank line, then the description. System Info has no
 * value to show, thus its pane is only the description.
 *
 * No setting can change yet, thus each row plays Select A only. The row
 * of the blade that opened this screen owns Back (`MenuListItem`).
 */
interface Setting {
  label: string;
  /** The lines under "Current Setting". Empty for a row with no setting, such as System Info. */
  current: string[];
  description: string;
}

const SETTINGS: Setting[] = [
  {
    label: "Display",
    current: ["TV", "Normal"],
    description:
      "Change your display output settings. Display settings include screen size, output mode, and HDTV.",
  },
  {
    label: "Audio",
    current: ["Digital Output", "Dolby Digital 5.1"],
    description: "Change your audio output settings, including digital output and speaker setup.",
  },
  {
    label: "Language",
    current: ["English"],
    description: "Choose the language that the console uses for its menus and text.",
  },
  {
    label: "Clock",
    current: ["12-Hour", "Daylight Saving Time On"],
    description: "Set the date, the time and the time zone of your console.",
  },
  {
    label: "Locale",
    current: ["United States"],
    description: "Choose the country or region where you live.",
  },
  {
    label: "Auto-Off",
    current: ["Off"],
    description: "Turn the console off by itself after six hours without use.",
  },
  {
    label: "Screen Saver",
    current: ["On"],
    description: "Dim the screen after a period without use, to protect your display.",
  },
  {
    label: "Remote Control",
    current: ["All Channels"],
    description: "Choose which remote controls can operate your console.",
  },
  {
    label: "System Info",
    current: [],
    description:
      "View information about your console, such as its serial number and its storage devices.",
  },
];

const SETTINGS_BY_LABEL = new Map(SETTINGS.map((s) => [s.label, s]));

const ITEMS: LibraryMenuItem[] = SETTINGS.map(({ label, description }) => ({
  label,
  description,
  icon: null,
  onSelect: () => {},
}));

/** The same radial purple as the canvas of the System blade (§2.1). */
const BACKGROUND = gradientCss(SYSTEM_GRADIENT);

export function ConsoleSettingsScreen() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current
      ?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)")
      ?.focus();
    return () => opener?.focus();
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Console Settings"
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink)"
      style={{ background: BACKGROUND, ...themeVars(SYSTEM_THEME) }}
    >
      <BladeScreenSurface gradient={SYSTEM_GRADIENT} />

      {/* The header and the legend are at z-0, below the shadow of the content band. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Console Settings
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={ITEMS[0]}>
        <div
          className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] py-6 md:grid-cols-2 md:gap-12"
          style={{ boxShadow: CONTENT_BAND_SHADOW }}
        >
          <div data-nav-list="column" className="flex min-w-0 flex-col">
            <LibraryMenu items={ITEMS} ariaLabel="Console settings" />
          </div>
          <SettingPane />
        </div>
      </LibraryMenuProvider>

      <BladeChromeBand
        edge="bottom"
        className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
      >
        <ButtonLegendBar
          left={[
            { label: "Y", letter: "Y", disabled: true },
            { label: "X", letter: "X", disabled: true },
          ]}
          right={[
            { label: "Back", letter: "B" },
            { label: "Select", letter: "A", sizePx: 28, fontSizePx: 21 },
          ]}
        />
      </BladeChromeBand>
    </div>,
    getPortalRoot(),
  );
}

/**
 * The pane of the highlighted setting (§6.18): "Current Setting" and its
 * values, a blank line, then the description. It follows the cursor
 * through `LibraryMenuProvider`, as `LibraryMenuDescription` does, but
 * it reads the values from `SETTINGS`, because a highlighted item only
 * carries a label and a description.
 */
function SettingPane() {
  const item = useHighlightedItem();
  const setting = item ? SETTINGS_BY_LABEL.get(item.label) : undefined;
  if (!setting) return null;
  return (
    <div
      aria-live="polite"
      className="max-w-[560px] pt-2 text-pretty text-[24px] leading-snug sm:text-[26px]"
    >
      {setting.current.length > 0 && (
        <div className="mb-[1lh]">
          <p className="text-[28px] leading-tight">Current Setting</p>
          {setting.current.map((line) => (
            <p key={line} className="text-(--blade-ink-soft)">
              {line}
            </p>
          ))}
        </div>
      )}
      <p>{setting.description}</p>
    </div>
  );
}
