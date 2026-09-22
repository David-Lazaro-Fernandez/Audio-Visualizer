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
import { CurlParticles } from "@/app/_particles/CurlParticles";
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
 * The Music Player (DESIGN.md §6.16), opened by Play Song on the song
 * screen (§6.15) or Play Album on the album screen (§6.14). Same
 * full-screen structure and Media blue as the rest of the chain.
 *
 * Two columns. The left is the player, gathered into one raised panel
 * (§6.9 skin): a row of five transport buttons, the wide "Edit or Save
 * Playlist" button, and the now-playing plate — artist over title, with
 * the visualizer under it and the bumper hints in its corners. The right
 * is the queue: "Current Playlist" over the same compact raised rows the
 * album screen uses, with the "N of M" counter at the foot.
 *
 * **It really plays.** Each track carries the store's 30-second preview
 * (`album-details.ts`), served CORS-open, so the `<audio>` element can be
 * read by a Web Audio `AnalyserNode` and the visualizer shows the actual
 * spectrum of the actual audio (`use-audio-spectrum.ts`) rather than a
 * synthetic one. Thirty seconds is all the store gives, so a track ends
 * early and the queue advances: that is the preview's limit, not a
 * placeholder.
 *
 * A browser will not start audio without a user gesture. Opening this
 * screen is one, so the first play usually succeeds — and when it is
 * refused the transport simply shows Play and waits, which is the honest
 * state rather than a silent lie.
 *
 * Y toggles the visualization, X blows it up full-screen — the first
 * screen in this chain whose left-hand legend slots are live rather than
 * dimmed (§6.5, §7.2). Back is owned by the row that opened this
 * (`MenuListItem` + `useBackKey`); the full-screen visualization owns its
 * own Back, so one press peels it off first (§5.4).
 */

/** Same radial blue as the Media blade canvas (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

/**
 * Transport glyphs. Simple monochrome shapes, so unlike the console's
 * full-colour bitmaps they *are* redrawn (§6.2) — as inline SVG in the
 * icon set's finish: translucent white fill, a light edge, inked detail.
 * Local to this screen rather than added to `MenuIcons.tsx`, which is the
 * menu-row set and nothing else uses these.
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
 * The "playing" mark on a queue row.
 *
 * A CSS shape, not the transport SVG: the raised button's icon box
 * oversizes *any* `svg` descendant to 44 px and lifts it 10 px (§6.2),
 * which is right for a menu glyph and far too big for a marker sitting
 * beside a track title. A border triangle sidesteps that selector
 * entirely, the way the more-below arrow and the row chevron already do.
 */
function PlayingMark() {
  return (
    <span
      aria-hidden="true"
      className="block h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-(--blade-ink)"
    />
  );
}

/** The raised skin the transport and playlist buttons share. */
const CONTROL_SKIN =
  "rounded-[8px] border border-[#5a5a5a] bg-[rgba(255,255,255,.22)] " +
  "transition-[background-color,box-shadow] duration-150 " +
  "hover:bg-[rgba(255,255,255,.55)] focus:bg-[rgba(255,255,255,.55)] focus:outline-none";

export function MusicPlayerScreen({
  album,
  tracks,
  startIndex = 0,
}: {
  album: Album;
  /** The queue. One track when opened from a song, the album otherwise. */
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

  // The queue's order is the only thing sorting changes; which track is
  // playing is tracked by title so it survives a reorder.
  const queue = useMemo(
    () => (reversed ? [...tracks].reverse() : tracks),
    [tracks, reversed],
  );
  const index = Math.max(0, queue.findIndex((track) => track.title === playing));
  const current = queue[index];

  // The same array every frame, mutated in place by the analyser: this
  // moves 60 times a second and must not go through React state.
  const spectrum = useAudioSpectrum(audioRef, VISUALIZER_BANDS);

  // Load and start whenever the track changes. `paused` is deliberately
  // not a dependency: toggling it must not reload the preview.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const source = current?.previewUrl;
    if (!source) {
      // Not every track in the store has a preview. Without this the
      // queue stalls on the silent one forever, since `onEnded` never
      // fires for audio that never started. Guarded on some track being
      // playable, or a queue of silent tracks would skip endlessly.
      if (queue.some((track) => track.previewUrl) && index < queue.length - 1) {
        step(1);
      }
      return;
    }
    audio.src = source;
    void audio.play().catch(() => setPaused(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.previewUrl]);

  // Reflect the transport's state onto the element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (paused) audio.pause();
    else void audio.play().catch(() => setPaused(true));
  }, [paused]);

  // The cursor opens on the track that is playing, not on the transport:
  // the queue is what you came here for, and Play Album should put you on
  // the first song of the album. Falls back to the first item on the
  // screen if the queue is somehow empty, so the cursor is never lost.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const rows = playlistRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
    const target =
      rows?.[startIndex] ??
      rows?.[0] ??
      rootRef.current?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)");
    target?.focus();
    return () => opener?.focus();
    // Mount only: `startIndex` is where the queue starts, not a live value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBackKey(fullScreen, () => {
    playSound("back");
    setFullScreen(false);
  });

  // The two live legend slots. Bound here rather than globally, because
  // every other screen leaves Y and X dimmed and a dimmed slot must not
  // answer a key (§7.2).
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
        // The bumpers cycle the visualizer, as the hints in the panel's
        // corners advertise. They wrap: there is no end of the list to
        // get stuck against.
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

  // Three of the seven are canvas-2D readings of the spectrum; the rest
  // are WebGL scenes — a wave field the music drops stones into, a
  // scrolling spectrogram, a curl-noise particle flow and a raymarched
  // core (§6.16). Held as an element rather than a component so
  // switching styles does not hand React a new component type and tear
  // the canvas down twice.
  const visual =
    visualizer.id === "water" ? (
      <WaterVisualizer paused={paused} spectrum={spectrum} />
    ) : visualizer.id === "spectrogram" ? (
      <SpectrogramVisualizer paused={paused} spectrum={spectrum} />
    ) : visualizer.id === "core" ? (
      // No geometry at all: a fullscreen quad marched per pixel. It is
      // fed the same live band array as everything else and folds it
      // into bass, treble and a centroid itself.
      <RaymarchCore
        bands={VISUALIZER_BANDS}
        paused={paused}
        sample={(out) => out.set(spectrum.subarray(0, out.length))}
      />
    ) : visualizer.id === "curl" ? (
      // The same particle system `/particles` runs, fed from the live
      // analyser instead of an offline transform. Orbiting is off: this
      // sits in a 10-foot UI, so the view drifts on its own.
      <CurlParticles
        bands={VISUALIZER_BANDS}
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
   * The left column is not a single list, so Up/Down have to hand the
   * cursor between the transport row and the button under it, and
   * Left/Right between the two columns. The transport row itself is a
   * 5-wide grid, so `KeyboardNav` already walks it with Left/Right.
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
      // Only from the last button: elsewhere Right steps along the row.
      const buttons = transportRef.current?.querySelectorAll("[data-nav-item]");
      if (buttons && buttons[buttons.length - 1] === target) {
        e.preventDefault();
        focusFirst(playlistRef);
      }
    }
  };

  const playlistItems: LibraryMenuItem[] = queue.map((track) => ({
    label: track.title,
    // A play triangle marks the track in progress; the rest carry no
    // glyph, as the console's queue did.
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

        {/* `crossOrigin` is load-bearing: without it the preview still
            plays, but the analyser reads only zeros and the visualizer
            sits flat. A preview is 30 s, so `onEnded` fires early and the
            queue moves on. */}
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
          {/* Player. One raised panel, as on the console. */}
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

            {/* Now playing: artist over title on a dark plate, the
                visualizer beneath, bumper hints in the corners. */}
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[6px] border border-[#5a5a5a] bg-[#0d0a10]">
              <div className="absolute inset-x-0 top-0 z-10 bg-black/70 px-4 py-3">
                <p className="truncate text-[19px] text-white/70">
                  {album.artist ?? "Unknown Artist"}
                </p>
                <p className="truncate text-[24px] font-bold text-white">
                  {current?.title ?? "Nothing playing"}
                </p>
              </div>
              {/* Inside a ternary this is already an expression, so the
                  element goes in bare: `{visual}` here would be an object
                  literal, not a JSX container. */}
              {visualization ? (
                visual
              ) : (
                <div className="h-full w-full bg-[#07060c]" />
              )}
              {/* The bumper hints are live: they cycle the visualizer, and
                  the name between them says which one you are on. */}
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

          {/* Queue. A long album overruns the slab, so the list is bounded
              and scrolls inside itself (`ScrollColumn`, shared with §6.12
              and §6.14) rather than pushing the page: the header band, the
              legend and the player column all have to stay put. The
              scrollbar is hidden and the more-below triangle stands in for
              it, and the counter rides the same footer row. */}
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

      {/* Tuning overlays, off by default: the dashboard is a 10-foot UI
          and has no controls (§8). Flip SHOW_VISUALIZER_CONTROLS to tune
          a field in place. The curl field and the core keep drifting
          either way — the walk runs from the scene, not the panel. */}
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

/** A player bound to one queue, for a menu row to open (see `screens.tsx`). */
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
