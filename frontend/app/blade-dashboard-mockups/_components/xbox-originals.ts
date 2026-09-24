/**
 * The catalogue of the Xbox Originals screen (DESIGN.md §6.19.2): the
 * original Xbox titles the store carries on, ported forward to this
 * console. Each entry names its cover art under
 * `public/assets/marketplace/xbox_games/` by file name, without the
 * extension, and its ESRB rating, whose badge lives under
 * `public/assets/marketplace/rates/`. `launchDate` is kept as the
 * source gave it, thus Crash Bandicoot's port note stays on the row
 * rather than being forced into a strict date.
 */
export type XboxOriginalsRating = "E" | "T" | "M";

export interface XboxOriginalGame {
  file: string;
  name: string;
  launchDate: string;
  rating: XboxOriginalsRating;
}

export const XBOX_ORIGINALS: XboxOriginalGame[] = [
  { file: "burnout_3", name: "Burnout 3: Takedown", launchDate: "Sep 7, 2004", rating: "T" },
  {
    file: "crash_cortex",
    name: "Crash Bandicoot: The Wrath of Cortex",
    launchDate: "Apr 2002 (Xbox port)",
    rating: "E",
  },
  { file: "fable", name: "Fable", launchDate: "Sep 14, 2004", rating: "M" },
  { file: "fusion_frenzy", name: "Fuzion Frenzy", launchDate: "Nov 15, 2001", rating: "E" },
  { file: "halo_2", name: "Halo 2", launchDate: "Nov 9, 2004", rating: "M" },
  { file: "halo_ce", name: "Halo: Combat Evolved", launchDate: "Nov 15, 2001", rating: "M" },
  { file: "ninja_black", name: "Ninja Gaiden Black", launchDate: "Sep 20, 2005", rating: "M" },
  { file: "psychonauts", name: "Psychonauts", launchDate: "Apr 19, 2005", rating: "T" },
  { file: "soul_calibur", name: "Soulcalibur II", launchDate: "Aug 27, 2003", rating: "T" },
];

const COVER_DIR = "/assets/marketplace/xbox_games";

export function xboxOriginalCoverUrl(file: string): string {
  return `${COVER_DIR}/${file}.webp`;
}

const RATING_URL: Record<XboxOriginalsRating, string> = {
  E: "/assets/marketplace/rates/rated_e.webp",
  T: "/assets/marketplace/rates/rated_t.webp",
  M: "/assets/marketplace/rates/rated_m.webp",
};

export function xboxOriginalRatingUrl(rating: XboxOriginalsRating): string {
  return RATING_URL[rating];
}
