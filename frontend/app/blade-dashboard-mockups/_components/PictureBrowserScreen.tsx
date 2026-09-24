"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, MEDIA_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { LibraryMenu, type LibraryMenuItem } from "./LibraryMenu";
import {
  RAISED_BORDER,
  RAISED_INSET_SHADOW,
  type MenuScreenProps,
} from "./MenuListItem";
import { MediaSlot } from "./MediaSlot";
import { MenuIcon } from "./MenuIcons";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import { getPortalRoot } from "./portal";
import { useBackKey } from "./back-stack";
import { playSound } from "./sounds";
import { asset } from "@/app/_lib/asset-path";
import {
  PICTURE_GRID_COLS,
  PICTURE_SLOTS,
  PICTURES,
  pictureSrc,
  type Picture,
} from "./pictures";
import { pictureViewerFor } from "./PictureViewerScreen";

/**
 * The picture browser, which the Computer row of the Pictures screen
 * opens (DESIGN.md §6.13.1). The path is: Media blade, Pictures, this
 * screen. It has the same full-screen structure as the Music Library and
 * album screens (§6.12, §6.14): the section gradient with the wave sheen
 * and no clip, the header and legend bands, the content as one raised
 * slab with `CONTENT_BAND_SHADOW`, and 12% side padding, in the Media
 * blue with `MEDIA_THEME` on its root.
 *
 * It reuses the two-column grammar of the album screen with the same
 * roles: a fixed left-hand menu of actions, here a single row, Play
 * Slideshow, which opens the picture viewer (§6.13.2) at the first
 * picture. The right column is the console's own thumbnail grid: three
 * columns of square tiles in the Achievements tile skin (§6.10), the same
 * nine slots the old Pictures screen filled directly (`PICTURE_SLOTS`,
 * `pictures.ts`). A slot past the end of the picture list stays the
 * striped placeholder (§6.7) and a cursor stop, exactly as it did before
 * this screen existed above it, and a tile with a picture opens the
 * viewer at that picture.
 *
 * A "N of M" counter under the grid follows the cursor, counting only the
 * real pictures and not the nine slots, as the console's own counter did
 * over a folder of eight photos in nine slots. Left from the first column
 * of tiles returns to Play Slideshow, and Right from it enters the grid,
 * the same handoff the album and Music Library screens give their two
 * columns (§6.12, §6.14).
 *
 * The legend follows the console: Y dimmed, X "Apply as Background" live
 * but unbound, the same kind of slot as the Marketplace blade's Sign Out
 * (§6.19), because the mockup has no background to apply one to. Back B
 * and Select A. The row that opened this screen owns Back (`MenuListItem`
 * with `useBackKey`), thus this screen takes no props.
 */
const SLOTS: (Picture | null)[] = Array.from(
  { length: PICTURE_SLOTS },
  (_, i) => PICTURES[i] ?? null,
);

/** The same radial blue as the canvas of the Media blade (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

export function PictureBrowserScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const [highlighted, setHighlighted] = useState<Picture | null>(SLOTS[0]);

  // Each tile carries a viewer bound to its own index (§6.13.2). Built
  // once at mount and not rebuilt at each render, thus a viewer open
  // under a tile is not remounted by an unrelated re-render elsewhere on
  // the grid, as `ALBUM_ENTRIES` is memoised for the same reason (§6.12).
  const tileScreens = useMemo(
    () => SLOTS.map((picture, i) => (picture ? pictureViewerFor(i) : null)),
    [],
  );
  const actionItems: LibraryMenuItem[] = useMemo(
    () => [
      {
        label: "Play Slideshow",
        icon: <MenuIcon name="play" />,
        screen: pictureViewerFor(0),
      },
    ],
    [],
  );

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>("[data-nav-item]")?.focus();
    return () => opener?.focus();
  }, []);

  const focusFirstTile = () => {
    const first = gridRef.current?.querySelector<HTMLElement>("[data-nav-item]");
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
      focusFirstTile();
      return;
    }
    if (e.key === "ArrowLeft" && gridRef.current?.contains(target)) {
      const tiles = gridRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
      const index = tiles ? Array.from(tiles).indexOf(target) : -1;
      // Only from the first column. At every other column Left moves
      // along the row, as the grid's own D-pad arithmetic already does.
      if (index !== -1 && index % PICTURE_GRID_COLS === 0) {
        e.preventDefault();
        focusActions();
      }
    }
  };

  const index = highlighted ? PICTURES.indexOf(highlighted) : -1;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Computer"
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
          Computer
        </h1>
      </BladeChromeBand>

      <div
        onKeyDown={onKeyDown}
        className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-8 overflow-hidden px-[12%] py-6 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-8"
        style={{ boxShadow: CONTENT_BAND_SHADOW }}
      >
        <div ref={actionsRef} data-nav-list="column" className="flex min-w-0 flex-col">
          <LibraryMenu items={actionItems} ariaLabel="Picture actions" />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col items-center gap-4">
          {/* A square grid with the height of the slab as its bound, as
              the old Pictures screen's own grid was. */}
          <ul
            ref={gridRef}
            data-nav-list={PICTURE_GRID_COLS}
            aria-label="Pictures"
            className="grid aspect-square min-h-0 max-w-full flex-1 grid-cols-3 grid-rows-3 gap-4"
          >
            {SLOTS.map((picture, i) => (
              <li key={picture?.file ?? `slot-${i}`} className="min-h-0">
                <PictureTile
                  picture={picture}
                  slot={i + 1}
                  screen={tileScreens[i]}
                  onHighlight={() => setHighlighted(picture)}
                />
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="h-8 shrink-0 text-center text-[22px] leading-tight">
            {PICTURES.length === 0 ? 0 : Math.max(index, 0) + 1} of {PICTURES.length}
          </p>
        </div>
      </div>

      <BladeChromeBand
        edge="bottom"
        className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
      >
        <ButtonLegendBar
          left={[
            { label: "Y", letter: "Y", disabled: true },
            { label: "Apply as Background", letter: "X" },
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
 * One grid cell, in the Achievements tile skin (§6.10). With a picture,
 * the image fills the tile (`object-cover`) behind an 8 px inset with
 * rounded corners, and Select opens the picture viewer above this screen
 * at that picture's index. With no picture, the cell is the striped
 * placeholder with the slot number as its watermark and Select does
 * nothing, as an empty slot already worked before this screen existed.
 *
 * The screen it opens is bound to this tile's own index, thus this
 * component keeps its own `open` state and its own `useBackKey`, the same
 * pattern `MenuListItem` uses for its `screen` prop, because a bespoke
 * square tile cannot be a `MenuListItem` row.
 */
function PictureTile({
  picture,
  slot,
  screen: Screen,
  onHighlight,
}: {
  picture: Picture | null;
  slot: number;
  screen: React.ComponentType<MenuScreenProps> | null;
  onHighlight: () => void;
}) {
  const [open, setOpen] = useState(false);

  const close = () => {
    playSound("back");
    setOpen(false);
  };

  useBackKey(open, close);

  const handleClick = () => {
    if (!picture || !Screen) return;
    playSound("selectA");
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        data-nav-item
        aria-label={picture ? picture.name : `Empty slot ${slot}`}
        aria-disabled={picture ? undefined : true}
        aria-expanded={Screen ? open : undefined}
        onFocus={onHighlight}
        onMouseEnter={() => {
          playSound("select");
          onHighlight();
        }}
        onClick={handleClick}
        className={`flex h-full w-full items-center justify-center rounded-[10px] bg-[rgba(255,255,255,.08)] p-2 transition-colors duration-150 hover:bg-[rgba(217,217,217,.55)] focus:bg-[rgba(217,217,217,.55)] focus:outline-none ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`}
      >
        {picture ? (
          <span className="relative block h-full w-full overflow-hidden rounded-[6px]">
            <Image
              src={asset(pictureSrc(picture))}
              alt={picture.name}
              fill
              sizes="(min-width: 768px) 25vw, 33vw"
              className="object-cover"
            />
          </span>
        ) : (
          <MediaSlot label={`picture ${slot}`} className="h-full" />
        )}
      </button>
      {Screen && open && <Screen onClose={close} />}
    </>
  );
}
