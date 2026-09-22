"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ParticleField } from "./ParticleField";
import { ParticleSphere } from "./ParticleSphere";
import { SphereControls } from "./SphereControls";
import { CurlParticles } from "@/app/_particles/CurlParticles";
import { CurlControls } from "@/app/_particles/CurlControls";
import { RaymarchCore } from "@/app/_raymarch/RaymarchCore";
import { RaymarchControls } from "@/app/_raymarch/RaymarchControls";
import {
  decodePreview,
  SlidingSpectrogram,
  WINDOW_SECONDS,
} from "./song-spectrogram";
import { artworkAt, lookupSong, type Song } from "./song-lookup";

/**
 * `/particles` — paste any Apple Music song and see the interval we take
 * from it as a cloud of particles in three dimensions.
 *
 * The flow is three steps, and each can fail in its own way, so each
 * reports separately: resolve the link to a preview (`song-lookup.ts`),
 * decode the preview and transform a window of it
 * (`song-spectrogram.ts`), and draw the grid (`ParticleField.tsx`).
 *
 * Only one second is analysed, and while the preview plays that second
 * **is** the second being heard: the window chases playback and the
 * cloud scrolls through the song. Paused, the slider throws the window
 * anywhere in the clip — the decoded buffer is kept, so that re-runs the
 * transform only, a few milliseconds, rather than re-fetching and
 * re-decoding.
 *
 * Four readings of the same window. **Curl** carries particles in a
 * divergence-free noise field, integrated on the GPU. **Sphere** throws
 * them along fixed trajectories computed in closed form from their age.
 * **Grid** lays the spectrogram out as a landscape. **Core** draws no
 * particles at all: one fullscreen quad, raymarched, the shape generated
 * from noise rather than stored. All four are driven by the same sliding
 * transform, so switching costs nothing but a remount of the scene.
 *
 * Core is the one to watch for performance here. Marching costs per
 * pixel, and full screen at 2x is an order of magnitude more pixels than
 * the player's tile, so its Resolution knob matters on this page in a
 * way it does not there.
 *
 * Playback position reaches the scene through a **ref, not state**. It
 * changes every frame, and re-rendering this page sixty times a second
 * would be absurd; the scene reads the same object inside its own loop
 * and drives the transform from it. Which is also why the slider is
 * disabled during playback rather than tracking it: keeping a React
 * slider in step with the audio would mean exactly the per-frame render
 * this avoids.
 */

/** What the page opens on, so there is something to look at immediately. */
const DEFAULT_SONG =
  "https://music.apple.com/us/song/sing-about-me-im-dying-of-thirst/1440819132";

type Status =
  | { state: "idle" }
  | { state: "working"; step: string }
  | { state: "error"; message: string };

export function ParticlesPage() {
  const [input, setInput] = useState(DEFAULT_SONG);
  const [song, setSong] = useState<Song | null>(null);
  const [analyser, setAnalyser] = useState<SlidingSpectrogram | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [playing, setPlaying] = useState(false);
  const [start, setStart] = useState(0);
  const [view, setView] = useState<"curl" | "sphere" | "grid" | "core">("curl");
  /** Kept so moving the window does not refetch or re-decode. */
  const bufferRef = useRef<AudioBuffer | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  /** Playback position in seconds. Mutated in place; never state. */
  const timeRef = useRef(0);
  /** Whether the window should chase playback. Mirrors `playing`. */
  const followRef = useRef(false);

  const load = useCallback(async (value: string) => {
    setStatus({ state: "working", step: "Looking the song up" });
    setAnalyser(null);
    bufferRef.current = null;
    timeRef.current = 0;
    try {
      const found = await lookupSong(value);
      setSong(found);
      setStatus({ state: "working", step: "Decoding the preview" });
      const buffer = await decodePreview(found.previewUrl);
      bufferRef.current = buffer;
      setStart(0);
      const sliding = new SlidingSpectrogram(buffer);
      sliding.fill(0);
      setAnalyser(sliding);
      setStatus({ state: "idle" });
    } catch (error) {
      setStatus({ state: "error", message: (error as Error).message });
    }
  }, []);

  /** Throws the window elsewhere in the clip. Milliseconds of work. */
  const moveWindow = useCallback(
    (seconds: number) => {
      setStart(seconds);
      analyser?.fill(seconds);
    },
    [analyser],
  );

  useEffect(() => {
    void load(DEFAULT_SONG);
  }, [load]);

  // Feed the scene the playback clock while something is playing. The
  // scene itself decides when a new slice is due, so this only reports
  // the time.
  useEffect(() => {
    followRef.current = playing;
    if (!playing) return;
    let frame = 0;
    const follow = () => {
      frame = requestAnimationFrame(follow);
      const audio = audioRef.current;
      if (audio) timeRef.current = audio.currentTime;
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  /**
   * Feeds the curl field and the core. Neither knows anything about
   * spectrograms — each asks for the current levels once a frame, and
   * advancing the offline window is this page's business. It is the same
   * function the dashboard supplies from a live analyser, which is why
   * the scenes are shared rather than reimplemented per route.
   */
  const sampleWindow = useCallback(
    (out: Float32Array) => {
      if (!analyser) return;
      if (followRef.current) analyser.advanceTo(timeRef.current);
      const base = analyser.head * analyser.bands;
      for (let band = 0; band < out.length; band++) {
        out[band] = analyser.levels[base + band];
      }
    },
    [analyser],
  );

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !song) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    // Start at the window being looked at, not at the top of the clip:
    // otherwise pressing play shows nothing for however many seconds
    // until the playhead reaches it.
    if (audio.currentTime < start || audio.currentTime > start + WINDOW_SECONDS) {
      audio.currentTime = start;
      timeRef.current = start;
    }
    void audio.play().catch(() => setPlaying(false));
  };

  const artwork = song ? artworkAt(song, 200) : null;
  const working = status.state === "working";

  return (
    <div className="relative flex flex-1 flex-col bg-[#05040a] text-zinc-200">
      {song && (
        <audio
          ref={audioRef}
          src={song.previewUrl}
          crossOrigin="anonymous"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-white/10 px-6 py-4">
        {artwork && (
          <Image
            src={artwork}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-white">
            {song?.title ?? "Particles"}
          </h1>
          <p className="truncate text-sm text-zinc-400">
            {song ? `${song.artist} — ${song.album}` : "Paste an Apple Music song link"}
          </p>
        </div>

        <div className="flex shrink-0 overflow-hidden rounded border border-white/10">
          {(["curl", "sphere", "grid", "core"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`px-3 py-1.5 text-sm capitalize ${
                view === option
                  ? "bg-cyan-400/20 text-cyan-200"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={!song || working}
          className="shrink-0 rounded border border-cyan-400/30 bg-cyan-400/15 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-40"
        >
          {playing ? "Pause" : "Play preview"}
        </button>
      </header>

      <form
        className="flex shrink-0 gap-2 border-b border-white/10 px-6 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          spellCheck={false}
          aria-label="Apple Music song link or id"
          placeholder="https://music.apple.com/us/song/…  or a track id"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-cyan-400/50"
        />
        <button
          type="submit"
          disabled={working}
          className="shrink-0 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-40"
        >
          Analyse
        </button>
      </form>

      {analyser && (
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-6 py-3">
          <span className="shrink-0 text-xs text-zinc-400">Window start</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, analyser.clipDuration - WINDOW_SECONDS)}
            step={0.05}
            value={start}
            disabled={playing}
            onChange={(event) => moveWindow(event.target.valueAsNumber)}
            aria-label="Which second of the preview to analyse"
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-cyan-400 disabled:cursor-default disabled:opacity-40"
          />
          <span className="shrink-0 font-mono text-xs tabular-nums text-cyan-300">
            {playing
              ? "following playback"
              : `${start.toFixed(2)}s – ${(start + WINDOW_SECONDS).toFixed(2)}s`}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-zinc-500">
            of {analyser.clipDuration.toFixed(1)}s
          </span>
        </div>
      )}

      {analyser && view === "sphere" && <SphereControls />}
      {analyser && view === "curl" && <CurlControls />}
      {analyser && view === "core" && <RaymarchControls />}

      <div className="relative min-h-0 flex-1">
        {analyser &&
          (view === "curl" ? (
            <CurlParticles
              bands={analyser.bands}
              sample={sampleWindow}
              className="absolute inset-0"
            />
          ) : view === "core" ? (
            <RaymarchCore
              bands={analyser.bands}
              sample={sampleWindow}
              className="absolute inset-0"
            />
          ) : view === "sphere" ? (
            <ParticleSphere
              analyser={analyser}
              timeRef={timeRef}
              followRef={followRef}
              className="absolute inset-0"
            />
          ) : (
            <ParticleField
              analyser={analyser}
              timeRef={timeRef}
              followRef={followRef}
              className="absolute inset-0"
            />
          ))}

        {(working || status.state === "error") && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            {working ? (
              <p className="text-sm text-zinc-400">{status.step}…</p>
            ) : (
              <p className="max-w-md text-sm text-red-300">{status.message}</p>
            )}
          </div>
        )}

        {analyser && (
          <p className="pointer-events-none absolute bottom-3 left-6 font-mono text-[11px] text-zinc-500">
            {analyser.frames} slices x {analyser.bands} bands,{" "}
            {((analyser.duration / analyser.frames) * 1000).toFixed(1)}ms each —{" "}
            {view === "grid"
              ? "x is time (newest at the lit edge), z is frequency, y is level"
              : view === "curl"
                ? "hue is frequency, brightness is level, the flow is curl noise"
                : view === "core"
                  ? "bass swells the body, treble roughens it, hue is the spectral centroid"
                  : "latitude is frequency, radius is loudness, age is distance"}
            {view === "core" ? "." : ". Drag to orbit, scroll to zoom."}
          </p>
        )}
      </div>
    </div>
  );
}
