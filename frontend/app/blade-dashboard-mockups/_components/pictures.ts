/**
 * The pictures that the picture browser shows (DESIGN.md §6.13.1). The
 * images are in `public/assets/demo-photos/`. To add a picture, put the
 * file there and add an entry here. The grid has nine slots. It does not
 * show more than nine entries, and a slot after the end of the list shows
 * the striped placeholder (§6.7), thus you can see the position of the
 * next picture.
 */
export interface Picture {
  /** The file name, under `public/assets/demo-photos/`. */
  file: string;
  /** The caption below the grid while the cursor is on the picture. It is also the alt text. */
  name: string;
}

export const PICTURES_DIR = "/assets/demo-photos";

/** The number of pictures in the grid: 3 x 3. */
export const PICTURE_GRID_COLS = 3;
export const PICTURE_SLOTS = PICTURE_GRID_COLS * PICTURE_GRID_COLS;

export const PICTURES: Picture[] = [
  { file: "1.webp", name: "Photo 1" },
  { file: "2.webp", name: "Photo 2" },
  { file: "3.webp", name: "Photo 3" },
  { file: "4.webp", name: "Photo 4" },
  { file: "5.webp", name: "Photo 5" },
  { file: "6.webp", name: "Photo 6" },
  { file: "7.webp", name: "Photo 7" },
  { file: "8.webp", name: "Photo 8" },
  { file: "9.webp", name: "Photo 9" },
];

export function pictureSrc(picture: Picture) {
  return `${PICTURES_DIR}/${picture.file}`;
}
