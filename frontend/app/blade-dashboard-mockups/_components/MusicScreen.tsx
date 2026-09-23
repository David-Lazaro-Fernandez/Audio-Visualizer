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
  type LibraryMenuItem,
} from "./LibraryMenu";
import { MediaSlot } from "./MediaSlot";
import { MenuIcon } from "./MenuIcons";
import { getPortalRoot } from "./portal";

/**
 * The Music screen, which the Music row of the Media blade opens
 * (DESIGN.md §6.11). It is full-screen, on the sky blue of the Media
 * blade and the same concentric wave sheen (BladeScreenSurface, with no
 * clip), as the Games Library is on green. There are darker header and
 * legend bands at the top and the bottom, and the content is one raised
 * slab between them. The portal root is outside the canvas, whose theme
 * variables are green by default (§2.2). Thus the screen sets the media
 * theme on its own root to keep the rows, the rules and the watermark
 * blue.
 *
 * The left column is the source list of the console, as blade rows.
 * "Music Player" is the first row and opens the Audiobooks browse screen
 * (§6.12) as the next surface in the stack; that row owns the screen and
 * its Back key (`MenuListItem`). The sources below it sit on a darker
 * slab, the chrome-band tint of §5.2, that continues to the bottom of the
 * content, and are all disabled: Hard Drive and Computer because the
 * catalogue lives behind Music Player now, Current Disc and Portable
 * Device because there is no disc and no device. The right column is the
 * pane, which shows the name of the highlighted row, its artwork and one
 * sentence.
 *
 * Icons: each row has a glyph of the monochrome set (§6.2): the disc and
 * note for Music Player, the hard drive, the monitor, the disc for
 * Current Disc, and a pocket player for Portable Device. The large music
 * note of the pane is a full-colour bitmap on the console, thus the pane
 * shows the striped placeholder (§6.7) until someone adds the image as
 * an `<Image>`.
 *
 * Keyboard: the screen has its own `data-nav-list` column. `aria-modal`
 * stops Left and Right from switching the blades below. The focus moves
 * to the first live row at the open and returns to the row that opened
 * the screen at the close. That row handles Back (`MenuListItem`), thus,
 * as with the Games Library, this screen takes no props and satisfies
 * `MenuScreenProps` and ignores `onClose`.
 */
const MUSIC_PLAYER_ITEM: LibraryMenuItem = {
  label: "Music Player",
  icon: <MenuIcon name="music" />,
  description: "Play music saved on your console's hard drive.",
  // Opens the Audiobooks browse screen (§6.12) above this screen.
  screen: "audiobooks",
};

const MUSIC_SOURCE_ITEMS: LibraryMenuItem[] = [
  {
    label: "Hard Drive",
    disabled: true,
    icon: <MenuIcon name="hardDrive" />,
    description: "Play music saved on your console's hard drive.",
  },
  {
    label: "Computer",
    disabled: true,
    icon: <MenuIcon name="computer" />,
    description: "Play music streamed from a Windows PC on your network.",
  },
  {
    label: "Current Disc",
    disabled: true,
    icon: <MenuIcon name="disc" />,
    description: "Play the audio CD in the disc tray.",
  },
  {
    label: "Portable Device",
    disabled: true,
    icon: <MenuIcon name="portableDevice" />,
    description: "Play music from a connected portable device.",
  },
];

/** The same radial blue as the canvas of the Media blade (§2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

export function MusicScreen() {
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
      aria-label="Music"
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
          Music
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={MUSIC_PLAYER_ITEM}>
        <div
          data-nav-list="column"
          className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] py-6 md:grid-cols-[minmax(0,45%)_1fr] md:gap-12"
          style={{ boxShadow: CONTENT_BAND_SHADOW }}
        >
          <div className="flex min-w-0 flex-col">
            <LibraryMenu items={[MUSIC_PLAYER_ITEM]} ariaLabel="Music player" />
            {/* The source slab: the chrome-band tint, with the corner that
                faces the pane rounded as on the bands (§5.2). It
                continues to the bottom of the content. */}
            <LibraryMenu
              items={MUSIC_SOURCE_ITEMS}
              ariaLabel="Music sources"
              className="flex-1 rounded-tr-[25px] bg-black/10"
            />
          </div>
          <LibraryMenuDescription
            showTitle
            titleClassName="mb-1 text-[30px] leading-tight"
            className="max-w-[560px] pt-2 text-pretty text-[24px] leading-snug sm:text-[26px]"
          >
            <div className="flex justify-center py-8">
              <div className="w-[120px]">
                <MediaSlot label="music art" className="aspect-square" />
              </div>
            </div>
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
