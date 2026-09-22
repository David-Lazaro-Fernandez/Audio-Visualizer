"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, MEDIA_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { LibraryMenu, type LibraryMenuItem } from "./LibraryMenu";
import { MenuIcon } from "./MenuIcons";
import {
  RAISED_BORDER,
  RAISED_INSET_SHADOW,
  type MenuScreenProps,
} from "./MenuListItem";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import { getPortalRoot } from "./portal";
import { albumGenre, albumHeading, type Track } from "./album-details";
import { musicPlayerFor } from "./MusicPlayerScreen";
import type { Album } from "./albums";

/**
 * The song screen, which a track row on the album screen opens
 * (DESIGN.md §6.15). The path is: Media blade, Music, Audiobooks,
 * album, this screen.
 *
 * It has the same full-screen structure and the same Media blue as the
 * album screen (§6.14), and the same left column of four actions. The
 * right column is different. The album screen lists the tracks. This
 * screen is a readout of the tags of one song, thus it uses the detail
 * panel skin of §6.9: the raised border and the one-sided bevel, a
 * header strip in the chrome-band tint, the music glyph, and then the
 * tags as pairs of a label and a value. It is never a cursor stop,
 * because it holds nothing to select.
 *
 * The tags come from the album of the song (`album-details.ts`), which
 * is also the source that a real library would use: the artist, the
 * album and the genre of a file are facts of the album.
 *
 * No action works yet, because there is no player, no playlist and no
 * tag editor. Thus each row plays Select A, as on the album screen. The
 * row that opened this screen owns Back (`MenuListItem` with
 * `useBackKey`).
 */

/** The actions that the console gave for a song. None of them works yet. */
const ACTIONS = [
  "Play Song",
  "Add to Current Playlist",
  "Edit Song Info",
  "Delete Song",
] as const;

/** The same radial blue as the canvas of the Media blade (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

export function SongScreen({ album, track }: { album: Album; track: Track }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current
      ?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)")
      ?.focus();
    return () => opener?.focus();
  }, []);

  // Play Song opens the player with a queue of one track (§6.16), which
  // is the "1 of 1" that the console showed.
  const actionItems: LibraryMenuItem[] = useMemo(
    () =>
      ACTIONS.map((label) =>
        label === "Play Song"
          ? { label, screen: musicPlayerFor(album, [track]) }
          : { label, onSelect: () => {} },
      ),
    [album, track],
  );

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={track.title}
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink)"
      style={{ background: BACKGROUND, ...themeVars(MEDIA_THEME) }}
    >
      <BladeScreenSurface gradient={MEDIA_GRADIENT} />

      {/* The header and the legend are at z-0, below the shadow of the content band. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="truncate text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          {track.title}
        </h1>
      </BladeChromeBand>

      <div
        className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-8 overflow-hidden px-[12%] py-6 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-8"
        style={{ boxShadow: CONTENT_BAND_SHADOW }}
      >
        <div data-nav-list="column" className="flex min-w-0 flex-col">
          <LibraryMenu items={actionItems} ariaLabel={`${track.title} actions`} />
        </div>

        <SongTags album={album} track={track} />
      </div>

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
 * The readout. It uses the detail panel skin (§6.9): a translucent
 * lighter blue, thus the brightness variation of the background shows
 * through, the raised border with the one-sided bevel, and a header
 * strip in the chrome-band tint in place of a rule. It is a readout and
 * not a control, thus it has no hover state, no focus state and no
 * disabled state, and it carries no `data-nav-item`.
 */
function SongTags({ album, track }: { album: Album; track: Track }) {
  return (
    <aside
      aria-label={`${track.title} details`}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`}
      style={{ background: "rgba(255,255,255,.12)" }}
    >
      <div className="bg-black/10 px-5 py-3 text-center">
        <p className="truncate text-[24px]">{track.title}</p>
      </div>

      {/* The note of the console here is a full-colour bitmap and is
          not redrawn (§6.2). The disc-and-note glyph of the set replaces
          it. */}
      <div className="flex shrink-0 items-center justify-center py-8 [&_svg]:h-24 [&_svg]:w-24">
        <MenuIcon name="music" />
      </div>

      <dl className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-6">
        <Tag label="Artist" value={album.artist ?? "Unknown Artist"} />
        <Tag label="Album" value={albumHeading(album)} />
        <Tag label="Genre" value={albumGenre(album) ?? "Unknown Genre"} />
      </dl>
    </aside>
  );
}

/** A label above its value, as the console showed the song tags. */
function Tag({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[20px] text-(--blade-ink-soft) opacity-70">{label}</dt>
      <dd className="truncate text-[24px]">{value}</dd>
    </div>
  );
}

/**
 * A song screen that is bound to one track, for a row of the album
 * screen to open.
 *
 * The screen takes arguments, thus a `ScreenKey` cannot name it
 * (`screens.tsx`). Each row carries its own component. The type
 * annotation makes `displayName` assignable, because a plain arrow
 * function has no such property.
 */
export function songScreenFor(
  album: Album,
  track: Track,
): React.ComponentType<MenuScreenProps> {
  const Screen: React.ComponentType<MenuScreenProps> = () => (
    <SongScreen album={album} track={track} />
  );
  Screen.displayName = `SongScreen(${track.title})`;
  return Screen;
}
