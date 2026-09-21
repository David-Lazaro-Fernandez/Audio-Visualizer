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
 * The "Music" screen the Media blade's Music row opens (DESIGN.md §6.11).
 * Full-screen on the Media blade's sky blue and the same concentric wave
 * sheen (BladeScreenSurface, unclipped), like the Games Library on green:
 * darker header and legend bands top and bottom, the content raised as one
 * slab between them. The portal root sits outside the canvas, whose theme
 * variables are green by default (§2.2), so the screen sets the media
 * theme on its own root to keep the rows, rules and watermark blue.
 *
 * Left column: the console's source list as blade rows. "Music Player"
 * heads it as an `unavailable` row (§7.2) — faded, but still where the
 * cursor lands, so the pane can say why it can't be used yet. Below it the
 * sources sit on a darker slab (the chrome-band tint, §5.2) that runs to
 * the bottom of the content: Hard Drive and Computer live, Current Disc and
 * Portable Device disabled with no disc or device attached. Right column:
 * the pane shows the highlighted row's name, its artwork and a
 * one-sentence blurb.
 *
 * Icons: the console's source glyphs (hard drive, monitor, USB plug) and the
 * pane's big music note are full-colour bitmaps, so per §6.2 they are not
 * redrawn in the monochrome finish. Those rows show the neutral square and
 * the pane the striped placeholder (§6.7) until the images are dropped in
 * as `icon: <Image src="/assets/…" />` / an `<Image>` in the pane. The two
 * glyphs the set already has — the disc-and-note for Music Player and the
 * disc for Current Disc — are reused.
 *
 * Hard Drive opens the Audiobooks browse screen (§6.12) as the next
 * surface in the stack; the row owns it and its Back key (`MenuListItem`).
 *
 * Keyboard: its own `data-nav-list` column; `aria-modal` keeps Left/Right
 * from flipping blades underneath. Focus moves to the first live row on
 * open and back to the opener on close. Back is handled by the row that
 * opened this screen (`MenuListItem`), so like the Games Library it takes
 * no props and satisfies `MenuScreenProps` by ignoring `onClose`.
 */
const MUSIC_PLAYER_ITEM: LibraryMenuItem = {
  label: "Music Player",
  unavailable: true,
  icon: <MenuIcon name="music" />,
  description: "Select a music source to play your music in the music player.",
};

const MUSIC_SOURCE_ITEMS: LibraryMenuItem[] = [
  {
    label: "Hard Drive",
    description: "Play music saved on your console's hard drive.",
    // Opens the Audiobooks browse screen (§6.12) over this one.
    screen: "audiobooks",
  },
  {
    label: "Computer",
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
    description: "Play music from a connected portable device.",
  },
];

/** Same radial blue as the Media blade canvas (§2.1). */
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

      {/* Header and legend sit at z-0, beneath the content band's shadow. */}
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
            {/* The source slab: the chrome-band tint with the corner facing
                the pane rounded like the bands (§5.2), running to the
                bottom of the content. */}
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
