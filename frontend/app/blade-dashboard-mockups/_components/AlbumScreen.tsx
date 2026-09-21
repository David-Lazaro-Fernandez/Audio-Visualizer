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
 * The album screen an album row in the Audiobooks browse list opens
 * (DESIGN.md §6.14) — Media blade → Music → Audiobooks → here.
 *
 * Same full-screen structure as every other surface the Media blade
 * opens (§5.4, §6.12): the section gradient with the unclipped water,
 * header and legend bands, the content raised as one slab with
 * `CONTENT_BAND_SHADOW`, 12% side padding, painted in the Media blade's
 * blue with its text and rule tints since full-screen surfaces portal
 * outside the canvas.
 *
 * It reuses the two-column grammar the Audiobooks screen already
 * established, with the roles swapped: the left column is a *fixed* menu
 * of things to do with this album (§6.2 `row`), not a filter, and the
 * right column is its track listing as compact raised buttons (§6.2
 * `button`, `compact`) with the duration in the meta slot. The "N of M"
 * counter at the foot follows the cursor through the tracks.
 *
 * Nothing here acts yet: there is no player, no playlist and no tag
 * editor, so every row plays Select A, as the Achievements grid did
 * before its detail screen existed. The rows are still real buttons and
 * still cursor stops, because the console's were.
 *
 * Back is owned by the row that opened this screen (`MenuListItem` +
 * `useBackKey`), so this takes no props beyond the album itself.
 */

/** What the console offered on an album. None of it is wired up yet. */
const ACTIONS = [
  "Play Album",
  "Add to Current Playlist",
  "Edit Album Info",
  "Delete Album",
] as const;

/** Same radial blue as the Media blade canvas (DESIGN.md §2.1). */
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

      {/* Header and legend sit at z-0, beneath the content band's shadow. */}
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
 * The two columns. Left/Right hand the cursor between them, exactly as on
 * the Audiobooks screen: Right from an action lands on the first track,
 * Left from a track returns to the action list. Both claim the key so
 * `KeyboardNav` leaves the blades alone underneath.
 *
 * Only the track column gets a `LibraryMenuProvider`: the counter follows
 * the tracks, and the action list has no description pane to drive, so
 * highlighting an action should not disturb anything.
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

  // Play Album opens the player on the whole album (§6.16); the rest
   // have nothing behind them yet and just play Select A.
  const actionItems: LibraryMenuItem[] = useMemo(
    () =>
      ACTIONS.map((label) =>
        label === "Play Album"
          ? { label, screen: musicPlayerFor(album, tracks) }
          : { label, onSelect: () => {} },
      ),
    [album, tracks],
  );

  // Memoised because each row carries a component bound to its track
  // (§6.15). Rebuilding those on every render would hand React a new
  // component type each time and remount the open song screen under the
  // cursor.
  const trackItems: LibraryMenuItem[] = useMemo(
    () =>
      tracks.map((track) => ({
        label: track.title,
        // The console's track lists carried no glyph at all (§6.2).
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

/** "1 of 12" at the foot of the track list, following the cursor. */
function TrackCounter({ tracks }: { tracks: Track[] }) {
  const highlighted = useHighlightedItem();
  const index = tracks.findIndex((track) => track.title === highlighted?.label);
  return (
    <p aria-live="polite" className="pl-5 text-[22px] text-(--blade-ink)">
      {tracks.length === 0 ? 0 : Math.max(index, 0) + 1} of {tracks.length}
    </p>
  );
}
