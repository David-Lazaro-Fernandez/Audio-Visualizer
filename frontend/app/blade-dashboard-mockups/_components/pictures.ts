/**
 * The pictures that the Pictures screen of the Media blade shows
 * (DESIGN.md §6.13). The images are in `public/assets/pictures/`. To add
 * a picture, put the file there and add an entry here. The grid has nine
 * slots. It does not show more than nine entries, and a slot after the
 * end of the list shows the striped placeholder (§6.7), thus you can see
 * the position of the next picture.
 */
export interface Picture {
  /** The file name, under `public/assets/pictures/`. */
  file: string;
  /** The caption below the grid while the cursor is on the picture. It is also the alt text. */
  name: string;
}

export const PICTURES_DIR = "/assets/pictures";

/** The number of pictures in the grid: 3 x 3. */
export const PICTURE_GRID_COLS = 3;
export const PICTURE_SLOTS = PICTURE_GRID_COLS * PICTURE_GRID_COLS;

export const PICTURES: Picture[] = [
  // { file: "beach.jpg", name: "Beach" },
];

export function pictureSrc(picture: Picture) {
  return `${PICTURES_DIR}/${picture.file}`;
}
