/**
 * The pictures the Media blade's Pictures screen shows (DESIGN.md §6.13).
 * Images live in `public/assets/pictures/`; add a file there and an entry
 * here. The grid has nine slots — extra entries are not shown, and slots
 * beyond the list show the striped placeholder (§6.7) so you can see where
 * a picture will land.
 */
export interface Picture {
  /** File name under `public/assets/pictures/`. */
  file: string;
  /** Caption shown under the grid while the cursor is on the picture; also the alt text. */
  name: string;
}

export const PICTURES_DIR = "/assets/pictures";

/** How many pictures the grid holds: 3 × 3. */
export const PICTURE_GRID_COLS = 3;
export const PICTURE_SLOTS = PICTURE_GRID_COLS * PICTURE_GRID_COLS;

export const PICTURES: Picture[] = [
  // { file: "beach.jpg", name: "Beach" },
];

export function pictureSrc(picture: Picture) {
  return `${PICTURES_DIR}/${picture.file}`;
}
