"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useGamerPic } from "./GamerPicContext";
import { ButtonGlyph } from "./ButtonGlyph";
import { LetterBadge } from "./LetterBadge";
import { isBackKey } from "./keys";
import { playSound } from "./sounds";

/** Columns in the picture grid — also tells `KeyboardNav` how Up/Down jump. */
const GRID_COLS = 4;

/**
 * The "player pic" slot on the gamer profile card (DESIGN.md §6.3).
 * Hovering reveals a subtle edit affordance; clicking opens the
 * "Change Gamer Picture" screen, modelled on the 360 dashboard's own:
 * black header bar (title / current pic / clock), a two-pane body — light
 * gray picture grid on the left with the selection framed in green, and a
 * mid-gray pane on the right echoing the profile card + Xbox logo — and a
 * black footer with the A/B button legend.
 */
export function GamerPicPicker({
  options,
  gamertag,
  games,
  score,
  achievements,
}: {
  options: string[];
  gamertag: string;
  games: number;
  score: number;
  achievements: number;
}) {
  const [open, setOpen] = useState(false);
  // Selection lives in GamerPicContext so the rest of the blade can read it.
  // `selected` is null until the user picks; fall back to the first option
  // in render (no seeding effect — that raced the localStorage read).
  const { selected, setSelected, hydrated } = useGamerPic();
  const effective = selected ?? options[0] ?? null;
  // Until the stored value is read, show the placeholder instead of
  // flashing the default image and then swapping.
  const current = hydrated ? effective : null;

  // Keyboard cursor handoff: opening moves focus onto the currently
  // selected picture in the grid; closing hands it back to the pencil.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      const grid = gridRef.current;
      const target =
        grid?.querySelector<HTMLElement>('[data-nav-item][aria-pressed="true"]') ??
        grid?.querySelector<HTMLElement>("[data-nav-item]");
      target?.focus();
    } else if (wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Opening is an A-press; any way of leaving (ESC, B, backdrop) is a B-press.
  const openPicker = () => {
    playSound("selectA");
    setOpen(true);
  };
  const goBack = () => {
    playSound("back");
    setOpen(false);
  };

  // Only registered while open, so ESC with nothing to go back from stays silent.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      playSound("back");
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div
        className="group relative h-[76px] w-[76px] shrink-0 rounded-[6px]"
        onMouseEnter={() => playSound("select")}
      >
        {current ? (
          <Image
            src={current}
            alt="Gamerpic"
            fill
            className="rounded-[6px] object-cover"
            style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)" }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-[6px]"
            style={{
              background:
                "repeating-linear-gradient(135deg, rgba(0,0,0,.10) 0 6px, rgba(0,0,0,.03) 6px 12px)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)",
            }}
          >
            <span className="text-center font-[family-name:var(--font-ibm-plex-mono)] text-[9px] text-[#5a5a5a]">
              player
              <br />
              pic
            </span>
          </div>
        )}
        <button
          ref={triggerRef}
          type="button"
          data-nav-item
          onClick={openPicker}
          aria-label="Change gamerpic"
          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-[6px] bg-black/25 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
        >
          <PencilIcon />
        </button>
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black p-4"
            onClick={goBack}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Change Gamer Picture"
              onClick={(e) => e.stopPropagation()}
              className="flex h-[min(715px,94vh)] w-full max-w-[990px] flex-col bg-black text-white"
            >
              {/* ── Header: title / current pic / clock ─────────────── */}
              <div className="relative flex h-[68px] shrink-0 items-center justify-between px-8">
                <span className="text-[26px] tracking-tight">
                  Change Gamer Picture
                </span>
                {effective && (
                  <div className="absolute left-1/2 top-2 h-[52px] w-[52px] -translate-x-1/2">
                    <Image
                      src={effective}
                      alt=""
                      fill
                      className="object-cover"
                      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.35)" }}
                    />
                  </div>
                )}
                <Clock />
              </div>

              {/* ── Body: two panes ─────────────────────────────────── */}
              <div className="mx-4 flex min-h-0 flex-1">
                {/* Left: picture grid */}
                <div className="min-h-0 flex-[0_0_48%] overflow-auto bg-[#e6e6e6] p-6">
                  <div
                    ref={gridRef}
                    data-nav-list={GRID_COLS}
                    className="grid grid-cols-4 gap-x-6 gap-y-6"
                  >
                    {options.map((src) => {
                      const isSelected = src === effective;
                      return (
                        <button
                          key={src}
                          type="button"
                          data-nav-item
                          onMouseEnter={() => playSound("select")}
                          onClick={() => {
                            playSound("selectA");
                            setSelected(src);
                          }}
                          aria-label="Select gamerpic"
                          aria-pressed={isSelected}
                          className="flex cursor-pointer items-center justify-center p-2 transition-colors duration-100 hover:bg-black/10 focus-visible:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1e8a1e]"
                          style={{
                            background: isSelected ? "#1e8a1e" : undefined,
                          }}
                        >
                          <div className="relative h-[72px] w-[72px]">
                            <Image
                              src={src}
                              alt=""
                              fill
                              className="object-cover"
                              style={{
                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)",
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: profile echo + dashboard logo + trophies */}
                <div className="flex min-h-0 flex-1 flex-col bg-[#8f8f8f] text-[#151515]">
                  {/* mini profile card */}
                  <div
                    className="m-0"
                    style={{
                      background:
                        "linear-gradient(180deg,#f4f4f4,#dedede 60%,#cfcfcf)",
                      boxShadow: "0 2px 6px rgba(0,0,0,.25)",
                    }}
                  >
                    <div className="truncate bg-[#6b6b6b] px-3 py-1 text-[20px] text-white">
                      {gamertag}
                    </div>
                    <div className="flex gap-4 p-3">
                      <div className="relative h-[76px] w-[76px] shrink-0">
                        {effective && (
                          <Image
                            src={effective}
                            alt=""
                            fill
                            className="object-cover"
                            style={{
                              boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)",
                            }}
                          />
                        )}
                      </div>
                      <div className="grid flex-1 grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-[2px] text-[19px]">
                        <span>Games</span>
                        <span className="text-right">{games}</span>
                        <span className="w-6" />
                        <span>Gamerscore</span>
                        <span className="text-right">{score}</span>
                        <span className="flex w-6 justify-end">
                          <LetterBadge>G</LetterBadge>
                        </span>
                        <span>Achievements</span>
                        <span className="text-right">{achievements}</span>
                        <span className="w-6" />
                      </div>
                    </div>
                  </div>

                  {/* dashboard logo */}
                  <div className="flex items-center gap-3 px-6 pt-6">
                    <Image
                      src="/assets/XBOX_LOGO.png"
                      alt=""
                      width={500}
                      height={500}
                      className="h-16 w-auto"
                    />
                    <span className="text-[22px]">Xbox 360 Dashboard</span>
                  </div>

                  {/* locked trophies */}
                  <div className="mt-auto flex gap-8 px-8 pb-8 opacity-60">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <TrophyIcon key={i} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Footer: A Select / B Back ───────────────────────── */}
              <div className="flex h-[60px] shrink-0 items-center gap-8 px-8">
                <button
                  type="button"
                  onClick={() => {
                    playSound("selectA");
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 text-[19px] hover:brightness-110"
                >
                  <ButtonGlyph letter="A" sizePx={24} />
                  Select
                </button>
                <button
                  type="button"
                  onClick={goBack}
                  className="flex cursor-pointer items-center gap-2 text-[19px] hover:brightness-110"
                >
                  <ButtonGlyph letter="B" sizePx={24} />
                  Back
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Live HH:MM AM/PM clock for the header, mirroring the dashboard's. */
function Clock() {
  const [now, setNow] = useState<string>(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-[22px] tabular-nums">{now}</span>;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Greyed-out trophy with a padlock, like the dashboard's locked slots. */
function TrophyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="#3a3a3a"
    >
      <path d="M6 3h12v2h3v3a4 4 0 0 1-4 4h-.3A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A6 6 0 0 1 7.3 12H7a4 4 0 0 1-4-4V5h3V3Zm0 4H5v1a2 2 0 0 0 2 2V7Zm12 0v3a2 2 0 0 0 2-2V7h-2Z" />
      <rect x="14" y="14" width="8" height="7" rx="1" fill="#2a2a2a" />
      <path
        d="M16 14v-1.5a2 2 0 0 1 4 0V14"
        stroke="#2a2a2a"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
