"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, MEDIA_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import {
  LibraryMenu,
  LibraryMenuDescription,
  LibraryMenuProvider,
  useHighlightedItem,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { MenuIcon, type MenuIconName } from "./MenuIcons";
import { getPortalRoot } from "./portal";

/**
 * The Pictures screen, which the Pictures row of the Media blade opens
 * (DESIGN.md §6.13). It has the same full-screen structure as the Games
 * Library and the Music screen (§5.4, §6.11): the section gradient with
 * the sheen and no clip, the header and legend bands, the content as one
 * raised slab with `CONTENT_BAND_SHADOW`, and 12% side padding. It is in
 * the Media blue with `MEDIA_THEME` on its root, thus the tints are the
 * tints of the blade that opened it.
 *
 * Unlike the nine-slot grid this screen used to be, it is a source list,
 * as the console's own Pictures screen was: two columns, a menu of the
 * four picture sources on the left and a description pane on the right
 * (§6.4). Computer is the one source this mockup can serve pictures
 * from, so it alone is live and opens the picture browser (§6.13.1);
 * Digital Camera, Current Disc and Portable Device stay disabled, the
 * console's own way of showing a source with nothing plugged into it.
 *
 * Icons: each row carries a glyph of the monochrome set (§6.2): the
 * `computer` monitor, the `pictures` camera, the `disc`, and the pocket
 * player of `portableDevice` (shared with the Music screen's sources,
 * §6.11). The pane shows the highlighted source's own glyph, oversized
 * and centred above the blurb, in place of the bitmap placeholder the
 * Music screen's pane falls back to (§6.7): a source is a device, and
 * the icon set already draws every one of these devices, so there is
 * nothing here still waiting on art.
 *
 * Keyboard: the screen has its own `data-nav-list` column. `aria-modal`
 * stops Left and Right from switching the blades below. The focus moves
 * to the first live row at the open and returns to the row that opened
 * the screen at the close. That row handles Back (`MenuListItem`), thus,
 * as with the Music screen, this screen takes no props and satisfies
 * `MenuScreenProps` and ignores `onClose`.
 */
interface SourceEntry {
  label: string;
  icon: MenuIconName;
  description: string;
  disabled?: boolean;
}

const SOURCES: SourceEntry[] = [
  {
    label: "Computer",
    icon: "computer",
    description: "View pictures from a Windows-based PC.",
  },
  {
    label: "Digital Camera",
    icon: "pictures",
    description: "View pictures from a digital camera connected to your console.",
    disabled: true,
  },
  {
    label: "Current Disc",
    icon: "disc",
    description: "View pictures from the disc in the disc tray.",
    disabled: true,
  },
  {
    label: "Portable Device",
    icon: "portableDevice",
    description: "View pictures from a connected portable device.",
    disabled: true,
  },
];

/** The same radial blue as the canvas of the Media blade (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

export function PicturesScreen() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current
      ?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)")
      ?.focus();
    return () => opener?.focus();
  }, []);

  const items: LibraryMenuItem[] = SOURCES.map((source) => ({
    label: source.label,
    disabled: source.disabled,
    icon: <MenuIcon name={source.icon} />,
    description: source.description,
    screen: source.label === "Computer" ? "picture-browser" : undefined,
  }));

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pictures"
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink)"
      style={{ background: BACKGROUND, ...themeVars(MEDIA_THEME) }}
    >
      <BladeScreenSurface gradient={MEDIA_GRADIENT} />

      {/* The header and the legend are at z-0, below the shadow of the content band. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Pictures
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={items[0]}>
        <div
          data-nav-list="column"
          className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] py-6 md:grid-cols-[minmax(0,45%)_1fr] md:gap-12"
          style={{ boxShadow: CONTENT_BAND_SHADOW }}
        >
          <LibraryMenu items={items} ariaLabel="Picture sources" />
          <LibraryMenuDescription
            showTitle
            titleClassName="mb-1 text-[30px] leading-tight"
            className="max-w-[560px] pt-2 text-pretty text-[24px] leading-snug sm:text-[26px]"
          >
            <SourceIcon />
          </LibraryMenuDescription>
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
 * The pane's icon has to match whichever source the cursor is on, thus it
 * cannot be `LibraryMenuDescription`'s static children as the Music
 * screen's one placeholder is (§6.11). It looks the source back up by
 * label, as `Browser` does on the Music Library screen to find the
 * highlighted category (§6.12).
 */
function SourceIcon() {
  const highlighted = useHighlightedItem();
  const source = SOURCES.find((entry) => entry.label === highlighted?.label) ?? SOURCES[0];
  return (
    <div className="flex justify-center py-8">
      <MenuIcon name={source.icon} className="h-[120px] w-[120px]" />
    </div>
  );
}
