"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, MEDIA_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { LibraryMenu, LibraryMenuProvider, type LibraryMenuItem } from "./LibraryMenu";
import {
  RAISED_BORDER,
  RAISED_INSET_SHADOW,
  type MenuScreenProps,
} from "./MenuListItem";
import { MusicVisualizer } from "./MusicVisualizer";
import { WaterVisualizer } from "./WaterVisualizer";
import { SpectrogramVisualizer } from "./SpectrogramVisualizer";
import { SpectrogramControls } from "./SpectrogramControls";
import { GridVisualizer } from "./GridVisualizer";
import { useCoveredSurface } from "./surface-stack";
import { CurlParticles, CURL_SIDE } from "@/app/_particles/CurlParticles";
import { RaymarchCore } from "@/app/_raymarch/RaymarchCore";
import { RaymarchControls } from "@/app/_raymarch/RaymarchControls";
import { CurlControls } from "@/app/_particles/CurlControls";
import {
  SHOW_VISUALIZER_CONTROLS,
  VISUALIZER_BANDS,
  VISUALIZER_STYLES,
} from "./visualizer-styles";
import { ScrollColumn } from "./ScrollColumn";
import { useAudioSpectrum } from "./use-audio-spectrum";
import { useBladePulse } from "./use-blade-pulse";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import { getPortalRoot } from "./portal";
import { useBackKey } from "./back-stack";
import {
  isLeftBumperKey,
  isRightBumperKey,
  isXKey,
  isYKey,
} from "./keys";
import { playSound } from "./sounds";
import { formatTrackLength, type Track } from "./album-details";
import type { Album } from "./albums";

/**
 * The Music Player (DESIGN.md §6.16). Play Song on the song screen
 * (§6.15) and Play Album on the album screen (§6.14) open it. It has
 * the same full-screen structure and the same Media blue as the other
 * screens in the chain.
 *
 * There are two columns. The left column is the player, in one raised
 * panel (the §6.9 skin): a row of five transport buttons, the wide
 * "Edit or Save Playlist" button, and the now-playing plate, which has
 * the artist above the title, the visualizer below them and the bumper
 * hints in its corners. The right column is the queue: "Current
 * Playlist" above the same compact raised rows as the album screen,
 * with the "N of M" counter at the foot.
 *
 * The player plays real audio. Each track has the 30-second preview of
 * the store (`album-details.ts`), served CORS-open. Thus a Web Audio
 * `AnalyserNode` can read the `<audio>` element, and the visualizer
 * shows the spectrum of the real audio (`use-audio-spectrum.ts`) and
 * not a synthetic spectrum. The store gives only 30 seconds, thus a
 * track ends early and the queue continues. That is the limit of the
 * preview and not a placeholder.
 *
 * A browser does not start audio without a user gesture. The action
 * that opens this screen is a gesture, thus the first play usually
 * starts. When the browser refuses it, the transport shows Play and
 * waits, which is the true state.
 *
 * Y switches the visualization on and off, and X opens it full-screen.
 * This is the first screen in the chain with live slots on the left of
 * the legend, and not dimmed slots (§6.5, §7.2). The row that opened
 * this screen owns Back (`MenuListItem` with `useBackKey`). The
 * full-screen visualization owns its own Back, thus one press closes it
 * first (§5.4).
 */

/** The same radial blue as the canvas of the Media blade (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

/**
 * The transport glyphs. They are simple monochrome shapes, thus this
 * code redraws them (§6.2), unlike the full-colour bitmaps of the
 * console. They are inline SVG in the finish of the icon set: a
 * translucent white fill, a light edge and inked detail. They are local
 * to this screen and are not in `MenuIcons.tsx`, which is the menu-row
 * set, because no other screen uses them.
 */
const GLYPHS = {
  pause: "M5 3h3.5v14H5zM11.5 3H15v14h-3.5z",
  play: "M5 3l11 7-11 7z",
  previous: "M5 3h2.5v14H5zm13 0v14l-9.5-7z",
  stop: "M4 4h12v12H4z",
  next: "M12.5 3H15v14h-2.5zM2 3l9.5 7L2 17z",
  sort: "M6 2l3.5 5h-7zM14 18l-3.5-5h7z",
} as const;

function TransportGlyph({ shape }: { shape: keyof typeof GLYPHS }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      <path
        d={GLYPHS[shape]}
        fill="rgba(255,255,255,.5)"
        stroke="rgba(255,255,255,.7)"
        strokeWidth="0.75"
      />
    </svg>
  );
}

/**
 * The playing mark on a queue row.
 *
 * It is a CSS shape and not the transport SVG. The icon box of the
 * raised button makes each `svg` descendant 44 px and lifts it 10 px
 * (§6.2). That is correct for a menu glyph and too large for a mark
 * beside a track title. A border triangle does not match that selector,
 * as with the more-below arrow and the row chevron.
 */
function PlayingMark() {
  return (
    <span
      aria-hidden="true"
      className="block h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-(--blade-ink)"
    />
  );
}

/** The raised skin of the transport buttons and the playlist button. */
const CONTROL_SKIN =
  "rounded-[8px] border border-[#5a5a5a] bg-[rgba(255,255,255,.22)] " +
  "transition-[background-color,box-shadow] duration-150 " +
  "hover:bg-[rgba(255,255,255,.55)] focus:bg-[rgba(255,255,255,.55)] focus:outline-none";

/**
 * The curl pool for the visualizer tile. It is a third of the particles
 * of the full-screen field, for a canvas a fifth of its height.
 */
const CURL_TILE_SIDE = 96;

export function MusicPlayerScreen({
  album,
  tracks,
  startIndex = 0,
}: {
  album: Album;
  /** The queue. It is one track from a song screen, else the full album. */
  tracks: Track[];
  startIndex?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transportRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const playlistRef = useRef<HTMLDivElement>(null);

  const [reversed, setReversed] = useState(false);
  const [playing, setPlaying] = useState(() => tracks[startIndex]?.title ?? "");
  const [paused, setPaused] = useState(false);
  const [visualization, setVisualization] = useState(true);
  const [styleIndex, setStyleIndex] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  // The full-screen visualization is opaque and covers everything,
  // including this screen's own water (`surface-stack.ts`). It has no
  // surface of its own, thus it registers and ignores the answer.
  useCoveredSurface(fullScreen);

  // A sort changes only the order of the queue. The code tracks the
  // current track by its title, thus the track stays correct after a
  // sort.
  const queue = useMemo(
    () => (reversed ? [...tracks].reverse() : tracks),
    [tracks, reversed],
  );
  const index = Math.max(0, queue.findIndex((track) => track.title === playing));
  const current = queue[index];

  // The same array at each frame, mutated in place by the analyser. It
  // changes 60 times a second and must not go through React state.
  const spectrum = useAudioSpectrum(audioRef, VISUALIZER_BANDS);

  // The background answers the bass, and also the tile (§6.16). The
  // same array drives a module-level envelope that each blade surface
  // reads, thus the gradient under the player and the blade behind it
  // swell together. The hook runs only while `visualization` is on,
  // because Y means no visualization on each surface and not only in
  // this box.
  useBladePulse(spectrum, visualization);

  // Load and start at each change of the track. `paused` is not a
  // dependency: a change to it must not load the preview again.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const source = current?.previewUrl;
    if (!source) {
      // Some tracks in the store have no preview. Without this code the
      // queue stops at a silent track, because `onEnded` does not fire
      // for audio that did not start. The code first tests that one
      // track can play, or a queue of silent tracks would skip without
      // an end.
      if (queue.some((track) => track.previewUrl) && index < queue.length - 1) {
        step(1);
      }
      return;
    }
    audio.src = source;
    void audio.play().catch(() => setPaused(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.previewUrl]);

  // Copy the state of the transport to the element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (paused) audio.pause();
    else void audio.play().catch(() => setPaused(true));
  }, [paused]);

  // The cursor starts on the track that plays and not on the transport.
  // The queue is the reason for the screen, and Play Album must put the
  // cursor on the first song of the album. With an empty queue the
  // cursor goes to the first item on the screen, thus it is never lost.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const rows = playlistRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
    const target =
      rows?.[startIndex] ??
      rows?.[0] ??
      rootRef.current?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)");
    target?.focus();
    return () => opener?.focus();
    // Mount only. `startIndex` is the start of the queue and not a live
    // value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBackKey(fullScreen, () => {
    playSound("back");
    setFullScreen(false);
  });

  // The two live legend slots. The binding is here and not global,
  // because each other screen keeps Y and X dimmed, and a dimmed slot
  // must not answer a key (§7.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isYKey(e)) {
        e.preventDefault();
        setVisualization((on) => !on);
        playSound("selectA");
      } else if (isXKey(e)) {
        e.preventDefault();
        setFullScreen(true);
        playSound("selectA");
      } else if (isLeftBumperKey(e) || isRightBumperKey(e)) {
        // The bumpers cycle the visualizer, as the hints in the corners
        // of the panel show. The list wraps, thus a user cannot reach an
        // end.
        e.preventDefault();
        const delta = isRightBumperKey(e) ? 1 : -1;
        setStyleIndex(
          (was) => (was + delta + VISUALIZER_STYLES.length) % VISUALIZER_STYLES.length,
        );
        playSound("select");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const visualizer = VISUALIZER_STYLES[styleIndex];

  // Three of the eight styles are canvas-2D views of the spectrum. The
  // others are WebGL scenes: a wave field that the music drops stones
  // into, a scrolling spectrogram, the same history as a landscape of
  // points, a curl-noise particle flow and a raymarched core (§6.16).
  // The code holds an element and not a component, thus a change of
  // style does not give React a new component type and does not destroy
  // the canvas two times.
  const visual =
    visualizer.id === "water" ? (
      <WaterVisualizer paused={paused} spectrum={spectrum} />
    ) : visualizer.id === "spectrogram" ? (
      <SpectrogramVisualizer paused={paused} spectrum={spectrum} />
    ) : visualizer.id === "grid" ? (
      // The grid view of `/particles`, fed from the live analyser. It
      // keeps its own ring of slices, because the analyser gives one
      // moment and this scene draws a history.
      <GridVisualizer paused={paused} spectrum={spectrum} />
    ) : visualizer.id === "core" ? (
      // There is no geometry: a fullscreen quad, marched for each
      // pixel. It takes the same live band array as the other styles and
      // folds it into a bass value, a treble value and a centroid.
      <RaymarchCore
        bands={VISUALIZER_BANDS}
        paused={paused}
        // The core of the dashboard is a tuned picture and not a region
        // to explore, thus its knobs do not move here. `/particles` and
        // each other scene keep their walk.
        drift={false}
        sample={(out) => out.set(spectrum.subarray(0, out.length))}
      />
    ) : visualizer.id === "curl" ? (
      // The same particle system as `/particles`, but the source is the
      // live analyser and not an offline transform. The orbit is off:
      // this is a 10-foot UI, thus the view drifts on its own.
      <CurlParticles
        bands={VISUALIZER_BANDS}
        // The cost of the field is the square of the pool, and the tile
        // is a fraction of the window. Only one of the two mounts at a
        // time, thus this is the pool of the canvas on the screen.
        side={fullScreen ? CURL_SIDE : CURL_TILE_SIDE}
        orbit={false}
        paused={paused}
        sample={(out) => out.set(spectrum.subarray(0, out.length))}
      />
    ) : (
      <MusicVisualizer paused={paused} spectrum={spectrum} style={visualizer.id} />
    );

  const step = (delta: number) => {
    const next = Math.min(queue.length - 1, Math.max(0, index + delta));
    setPlaying(queue[next]?.title ?? "");
    setPaused(false);
    playSound("selectA");
  };

  const focusFirst = (container: React.RefObject<HTMLDivElement | null>) => {
    const first = container.current?.querySelector<HTMLElement>("[data-nav-item]");
    if (!first) return false;
    first.focus();
    playSound("select");
    return true;
  };

  /**
   * The left column is not one list. Thus Up and Down move the cursor
   * between the transport row and the button below it, and Left and
   * Right move it between the two columns. The transport row is a grid
   * five wide, thus `KeyboardNav` already moves through it with Left and
   * Right.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const inTransport = transportRef.current?.contains(target) ?? false;
    const onEdit = editRef.current?.contains(target) ?? false;
    const inPlaylist = playlistRef.current?.contains(target) ?? false;

    if (e.key === "ArrowDown" && inTransport) {
      e.preventDefault();
      focusFirst(editRef);
    } else if (e.key === "ArrowUp" && onEdit) {
      e.preventDefault();
      focusFirst(transportRef);
    } else if (e.key === "ArrowRight" && onEdit) {
      e.preventDefault();
      focusFirst(playlistRef);
    } else if (e.key === "ArrowLeft" && inPlaylist) {
      e.preventDefault();
      focusFirst(editRef);
    } else if (e.key === "ArrowRight" && inTransport) {
      // Only from the last button. At the other buttons Right moves
      // along the row.
      const buttons = transportRef.current?.querySelectorAll("[data-nav-item]");
      if (buttons && buttons[buttons.length - 1] === target) {
        e.preventDefault();
        focusFirst(playlistRef);
      }
    }
  };

  const playlistItems: LibraryMenuItem[] = queue.map((track) => ({
    label: track.title,
    // A play triangle marks the track that plays. The other rows have no
    // glyph, as in the queue of the console.
    icon: track.title === current?.title ? <PlayingMark /> : null,
    meta: formatTrackLength(track.ms) || undefined,
    onSelect: () => {
      setPlaying(track.title);
      setPaused(false);
    },
  }));

  const transport: { label: string; shape: keyof typeof GLYPHS; act: () => void }[] = [
    {
      label: paused ? "Play" : "Pause",
      shape: paused ? "play" : "pause",
      act: () => {
        setPaused((was) => !was);
        playSound("selectA");
      },
    },
    { label: "Previous track", shape: "previous", act: () => step(-1) },
    {
      label: "Stop",
      shape: "stop",
      act: () => {
        const audio = audioRef.current;
        if (audio) audio.currentTime = 0;
        setPlaying(queue[0]?.title ?? "");
        setPaused(true);
        playSound("selectA");
      },
    },
    { label: "Next track", shape: "next", act: () => step(1) },
    {
      label: "Reverse playlist order",
      shape: "sort",
      act: () => {
        setReversed((was) => !was);
        playSound("selectA");
      },
    },
  ];

  return createPortal(
    <>
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Music Player"
        className="fixed inset-0 z-40 flex flex-col text-(--blade-ink)"
        style={{ background: BACKGROUND, ...themeVars(MEDIA_THEME) }}
      >
        <BladeScreenSurface gradient={MEDIA_GRADIENT} />

        {/* `crossOrigin` is necessary. Without it the preview plays, but
            the analyser reads only zeros and the visualizer stays flat.
            A preview is 30 s, thus `onEnded` fires early and the queue
            continues. */}
        <audio
          ref={audioRef}
          crossOrigin="anonymous"
          preload="auto"
          onEnded={() => step(1)}
        />

        <BladeChromeBand
          edge="top"
          className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
        >
          <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
            Music Player
          </h1>
        </BladeChromeBand>

        <div
          onKeyDown={onKeyDown}
          className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-8 overflow-hidden px-[12%] py-6 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-8"
          style={{ boxShadow: CONTENT_BAND_SHADOW }}
        >
          {/* The player, in one raised panel, as on the console. */}
          <div
            className={`flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-[10px] p-3 ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`}
            style={{ background: "rgba(255,255,255,.12)" }}
          >
            <div
              ref={transportRef}
              data-nav-list="5"
              role="group"
              aria-label="Playback controls"
              className="flex shrink-0 gap-2"
            >
              {transport.map(({ label, shape, act }) => (
                <button
                  key={label}
                  type="button"
                  data-nav-item
                  aria-label={label}
                  onClick={act}
                  className={`flex flex-1 items-center justify-center py-2 ${CONTROL_SKIN}`}
                >
                  <TransportGlyph shape={shape} />
                </button>
              ))}
            </div>

            <div ref={editRef} data-nav-list="column" className="shrink-0">
              <button
                type="button"
                data-nav-item
                onClick={() => playSound("selectA")}
                className={`w-full px-4 py-2 text-left text-[22px] ${CONTROL_SKIN}`}
              >
                Edit or Save Playlist
              </button>
            </div>

            {/* The now-playing plate: the artist above the title on a
                dark plate, the visualizer below them, and the bumper
                hints in the corners. */}
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[6px] border border-[#5a5a5a] bg-[#0d0a10]">
              <div className="absolute inset-x-0 top-0 z-10 bg-black/70 px-4 py-3">
                <p className="truncate text-[19px] text-white/70">
                  {album.artist ?? "Unknown Artist"}
                </p>
                <p className="truncate text-[24px] font-bold text-white">
                  {current?.title ?? "Nothing playing"}
                </p>
              </div>
              {/* This is already an expression, because it is in a
                  ternary. Thus the element needs no braces: `{visual}`
                  here would be an object literal and not a JSX
                  container. */}
              {/* Not while the full-screen copy is up. The tile is
                  behind an opaque overlay, thus a second instance here
                  would simulate and draw a whole second field that
                  nothing can see. One remount on the way in and one on
                  the way out is the cheaper trade. */}
              {visualization && !fullScreen ? (
                visual
              ) : (
                <div className="h-full w-full bg-[#07060c]" />
              )}
              {/* The bumper hints are live: they cycle the visualizer, and
                  the name between them gives the current style. */}
              <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
                <span className="rounded-[4px] bg-white/25 px-1.5 text-[13px] text-white/80">
                  LB
                </span>
                {visualization && (
                  <span className="truncate text-[13px] uppercase tracking-wide text-white/60">
                    {visualizer.label}
                  </span>
                )}
                <span className="rounded-[4px] bg-white/25 px-1.5 text-[13px] text-white/80">
                  RB
                </span>
              </div>
            </div>
          </div>

          {/* The queue. A long album is taller than the slab, thus the
              list has a bound and scrolls in itself (`ScrollColumn`,
              shared with §6.12 and §6.14) and does not make the page
              longer. The header band, the legend and the player column
              must stay in position. The scrollbar is hidden and the
              more-below triangle replaces it. The counter is on the same
              footer row. */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <h2 className="shrink-0 text-[30px]">Current Playlist</h2>
            <div
              ref={playlistRef}
              data-nav-list="column"
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <LibraryMenuProvider initialItem={playlistItems[0]}>
                <ScrollColumn
                  footer={
                    <p aria-live="polite" className="pl-5 text-[22px]">
                      {queue.length === 0 ? 0 : index + 1} of {queue.length}
                    </p>
                  }
                >
                  <LibraryMenu
                    layout="buttons"
                    compact
                    items={playlistItems}
                    ariaLabel="Current playlist"
                  />
                </ScrollColumn>
              </LibraryMenuProvider>
            </div>
          </div>
        </div>

        <BladeChromeBand
          edge="bottom"
          className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
        >
          <ButtonLegendBar
            left={[
              {
                label: visualization ? "Turn Visualization Off" : "Turn Visualization On",
                letter: "Y",
              },
              { label: "Full Screen Visualization", letter: "X" },
            ]}
            right={[
              { label: "Back", letter: "B" },
              { label: "Select", letter: "A", sizePx: 28, fontSizePx: 21 },
            ]}
          />
        </BladeChromeBand>
      </div>

      {/* The tuning overlays. They are off by default, because the
          dashboard is a 10-foot UI and has no controls (§8). Set
          SHOW_VISUALIZER_CONTROLS to tune a field in place. The curl
          field drifts in both conditions, because its walk runs from the
          scene and not from the panel. The core holds the tuned values
          above. */}
      {SHOW_VISUALIZER_CONTROLS && visualizer.id === "spectrogram" && (
        <SpectrogramControls />
      )}
      {SHOW_VISUALIZER_CONTROLS && visualizer.id === "curl" && <CurlControls />}
      {SHOW_VISUALIZER_CONTROLS && visualizer.id === "core" && <RaymarchControls />}

      {fullScreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full screen visualization"
          className="fixed inset-0 z-50 bg-[#07060c]"
        >
          {visual}
        </div>
      )}
    </>,
    getPortalRoot(),
  );
}

/** A player that is bound to one queue, for a menu row to open. Refer to `screens.tsx`. */
export function musicPlayerFor(
  album: Album,
  tracks: Track[],
  startIndex = 0,
): React.ComponentType<MenuScreenProps> {
  const Screen: React.ComponentType<MenuScreenProps> = () => (
    <MusicPlayerScreen album={album} tracks={tracks} startIndex={startIndex} />
  );
  Screen.displayName = `MusicPlayerScreen(${album.title})`;
  return Screen;
}
