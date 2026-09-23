"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, MEDIA_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import {
  LibraryMenu,
  LibraryMenuProvider,
  useHighlightedItem,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { MenuIcon, type MenuIconName } from "./MenuIcons";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import { getPortalRoot } from "./portal";
import { ScrollColumn } from "./ScrollColumn";
import { playSound } from "./sounds";
import {
  albumHeading,
  albumTracks,
  formatTrackLength,
  type Track,
} from "./album-details";
import type { Album } from "./albums";
import { songScreenFor } from "./SongScreen";
import { musicPlayerFor } from "./MusicPlayerScreen";

/**
 * The album screen, which an album row in the Audiobooks browse list
 * opens (DESIGN.md §6.14). The path is: Media blade, Music, Audiobooks,
 * this screen.
 *
 * It has the same full-screen structure as each other surface that the
 * Media blade opens (§5.4, §6.12): the section gradient with the water
 * and no clip, the header and legend bands, the content as one raised
 * slab with `CONTENT_BAND_SHADOW`, and 12% side padding. It is in the
 * blue of the Media blade with its text and rule tints, because a
 * full-screen surface portals outside the canvas.
 *
 * It uses the two-column grammar of the Audiobooks screen with the roles
 * exchanged. The left column is a fixed menu of actions for this album
 * (§6.2 `row`) and not a filter. The right column is the track listing,
 * as compact raised buttons (§6.2 `button`, `compact`), with the
 * duration in the meta slot. The "N of M" counter at the foot follows
 * the cursor through the tracks.
 *
 * No action works yet: there is no player, no playlist and no tag
 * editor. Thus each row plays Select A, as the Achievements grid did
 * before its detail screen existed. The rows are real buttons and cursor
 * stops, because the rows of the console were.
 *
 * The row that opened this screen owns Back (`MenuListItem` with
 * `useBackKey`), thus this screen takes only the album as a prop.
 */

/** The actions that the console gave for an album. None of them works yet. */
const ACTIONS: { label: string; icon: MenuIconName }[] = [
  { label: "Play Album", icon: "play" },
  { label: "Add to Current Playlist", icon: "addToPlaylist" },
  { label: "Edit Album Info", icon: "edit" },
  { label: "Delete Album", icon: "delete" },
];

/** The same radial blue as the canvas of the Media blade (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

export function AlbumScreen({ album }: { album: Album }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tracks = albumTracks(album);

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
      aria-label={album.title}
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
          {albumHeading(album)}
        </h1>
      </BladeChromeBand>

      <Columns album={album} tracks={tracks} />

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
 * The two columns. Left and Right move the cursor between them, as on
 * the Audiobooks screen: Right from an action goes to the first track,
 * and Left from a track returns to the action list. Both columns take
 * the key, thus `KeyboardNav` does not switch the blades below.
 *
 * Only the track column has a `LibraryMenuProvider`. The counter follows
 * the tracks, and the action list has no description pane. Thus a
 * highlight on an action must change nothing.
 */
function Columns({ album, tracks }: { album: Album; tracks: Track[] }) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);

  const focusFirstTrack = () => {
    const first = tracksRef.current?.querySelector<HTMLElement>("[data-nav-item]");
    if (!first) return;
    first.focus();
    playSound("select");
  };

  const focusActions = () => {
    const row = actionsRef.current?.querySelector<HTMLElement>("[data-nav-item]");
    if (!row) return;
    row.focus();
    playSound("select");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === "ArrowRight" && actionsRef.current?.contains(target)) {
      e.preventDefault();
      focusFirstTrack();
    } else if (e.key === "ArrowLeft" && tracksRef.current?.contains(target)) {
      e.preventDefault();
      focusActions();
    }
  };

  // Play Album opens the player with the full album (§6.16). The other
   // actions have no behaviour yet and play Select A only.
  const actionItems: LibraryMenuItem[] = useMemo(
    () =>
      ACTIONS.map(({ label, icon }) =>
        label === "Play Album"
          ? { label, icon: <MenuIcon name={icon} />, screen: musicPlayerFor(album, tracks) }
          : { label, icon: <MenuIcon name={icon} />, onSelect: () => {} },
      ),
    [album, tracks],
  );

  // This is memoised because each row carries a component that is bound
  // to its track (§6.15). A rebuild at each render would give React a
  // new component type each time and would remount the open song screen
  // under the cursor.
  const trackItems: LibraryMenuItem[] = useMemo(
    () =>
      tracks.map((track) => ({
        label: track.title,
        // The track lists of the console had no glyph (§6.2).
        icon: null,
        meta: formatTrackLength(track.ms) || undefined,
        screen: songScreenFor(album, track),
      })),
    [album, tracks],
  );

  return (
    <div
      onKeyDown={onKeyDown}
      className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-8 overflow-hidden px-[12%] py-6 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-8"
      style={{ boxShadow: CONTENT_BAND_SHADOW }}
    >
      <div ref={actionsRef} data-nav-list="column" className="flex min-w-0 flex-col">
        <LibraryMenu items={actionItems} ariaLabel={`${album.title} actions`} />
      </div>

      <div ref={tracksRef} data-nav-list="column" className="flex min-h-0 min-w-0 flex-col">
        <LibraryMenuProvider initialItem={trackItems[0]}>
          <ScrollColumn footer={<TrackCounter tracks={tracks} />}>
            <LibraryMenu
              layout="buttons"
              compact
              items={trackItems}
              ariaLabel={`${album.title} tracks`}
            />
          </ScrollColumn>
        </LibraryMenuProvider>
      </div>
    </div>
  );
}

/** The "1 of 12" counter at the foot of the track list. It follows the cursor. */
function TrackCounter({ tracks }: { tracks: Track[] }) {
  const highlighted = useHighlightedItem();
  const index = tracks.findIndex((track) => track.title === highlighted?.label);
  return (
    <p aria-live="polite" className="pl-5 text-[22px] text-(--blade-ink)">
      {tracks.length === 0 ? 0 : Math.max(index, 0) + 1} of {tracks.length}
    </p>
  );
}
