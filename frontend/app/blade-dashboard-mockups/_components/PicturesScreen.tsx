"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, MEDIA_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { MediaSlot } from "./MediaSlot";
import { RAISED_BORDER, RAISED_INSET_SHADOW } from "./MenuListItem";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import {
  PICTURE_GRID_COLS,
  PICTURE_SLOTS,
  PICTURES,
  pictureSrc,
  type Picture,
} from "./pictures";
import { getPortalRoot } from "./portal";
import { playSound } from "./sounds";

/**
 * The Pictures screen, which the Pictures row of the Media blade opens
 * (DESIGN.md §6.13). It has the same full-screen structure as the Games
 * Library, My Games and Audiobooks (§5.4): the section gradient with the
 * sheen and no clip, the header and legend bands, the content as one
 * raised slab with `CONTENT_BAND_SHADOW`, and 12% side padding. It is in
 * the Media blue with `MEDIA_THEME` on its root, thus the tints are the
 * tints of the blade that opened it.
 *
 * The body is a 3x3 grid of square tiles in the Achievements tile skin
 * (§6.10: the raised border and bevel on white at 8%, with the pale grey
 * wash as the cursor). Each tile shows one picture from `pictures.ts`,
 * which fills the tile behind a small inset. A slot after the end of the
 * list shows the striped placeholder (§6.7) with its slot number, thus
 * the position of the next picture is clear. An empty slot stays a
 * cursor stop, as an `unavailable` row does (§7.2), thus the grid
 * arithmetic of the D-pad stays correct. Select does nothing on an empty
 * slot. A caption below the grid names the highlighted picture.
 *
 * Keyboard: the grid is `data-nav-list="3"`, thus Up and Down step one
 * row and Left and Right step one column (`KeyboardNav`), with a clamp
 * at the edges. The focus goes to the first tile at the open and returns
 * to the row that opened the screen at the close. The legend is Y and X
 * unbound, Back B and Select A. That row owns Back (`MenuListItem` with
 * `useBackKey`), thus this screen takes no props.
 */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

const SLOTS: (Picture | null)[] = Array.from(
  { length: PICTURE_SLOTS },
  (_, i) => PICTURES[i] ?? null,
);

export function PicturesScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState<Picture | null>(SLOTS[0]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>("[data-nav-item]")?.focus();
    return () => opener?.focus();
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pictures"
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
          Pictures
        </h1>
      </BladeChromeBand>

      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center gap-4 px-[12%] py-6"
        style={{ boxShadow: CONTENT_BAND_SHADOW }}
      >
        {/* A square grid with the height of the slab as its bound.
            `flex-1` with `aspect-square` keeps the nine tiles square and
            centred at each viewport size. */}
        <ul
          data-nav-list={PICTURE_GRID_COLS}
          aria-label="Pictures"
          className="grid aspect-square min-h-0 max-w-full flex-1 grid-cols-3 grid-rows-3 gap-4"
        >
          {SLOTS.map((picture, i) => (
            <li key={picture?.file ?? `slot-${i}`} className="min-h-0">
              <PictureTile
                picture={picture}
                slot={i + 1}
                onHighlight={() => setHighlighted(picture)}
              />
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="h-8 shrink-0 text-center text-[24px] leading-tight">
          {highlighted?.name}
        </p>
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
 * One grid cell, in the Achievements tile skin. With a picture, the
 * image fills the tile (`object-cover`) behind an 8 px inset with
 * rounded corners. With no picture, the cell is the striped placeholder
 * with the slot number as its watermark. Select on a picture plays
 * Select A only, until the viewer exists.
 */
function PictureTile({
  picture,
  slot,
  onHighlight,
}: {
  picture: Picture | null;
  slot: number;
  onHighlight: () => void;
}) {
  return (
    <button
      type="button"
      data-nav-item
      aria-label={picture ? picture.name : `Empty slot ${slot}`}
      aria-disabled={picture ? undefined : true}
      onFocus={onHighlight}
      onMouseEnter={() => {
        playSound("select");
        onHighlight();
      }}
      onClick={() => picture && playSound("selectA")}
      className={`flex h-full w-full items-center justify-center rounded-[10px] bg-[rgba(255,255,255,.08)] p-2 transition-colors duration-150 hover:bg-[rgba(217,217,217,.55)] focus:bg-[rgba(217,217,217,.55)] focus:outline-none ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`}
    >
      {picture ? (
        <span className="relative block h-full w-full overflow-hidden rounded-[6px]">
          <Image
            src={pictureSrc(picture)}
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
  );
}
