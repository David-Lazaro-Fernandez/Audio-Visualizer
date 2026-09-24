/**
 * The data of the TV Shows screen (DESIGN.md §6.19.3). `TOP_TV_EPISODES`
 * is a five-episode sample of the console's own "Top TV Episodes"
 * chart; `TOP_TV_EPISODES_TOTAL` is the chart's real size, which the
 * screen's counter shows as its denominator even though this mockup
 * only carries five rows. Art lives under
 * `public/assets/marketplace/tv-shows/`: `tvShowLogoUrl` resolves an
 * episode's `show` to its logo, and `TV_SHOWS_PROMO` is the promo
 * banner beneath the menu tiles.
 */
export interface TvEpisode {
  episode: string;
  show: string;
  season: number;
  number: number;
  /** ISO date, as the source gave it. */
  airDate: string;
  rating: string;
}

export const TOP_TV_EPISODES_TOTAL = 50;

export const TOP_TV_EPISODES: TvEpisode[] = [
  {
    episode: "Ozymandias",
    show: "Breaking Bad",
    season: 5,
    number: 14,
    airDate: "2013-09-15",
    rating: "TV-MA",
  },
  {
    episode: "The Rains of Castamere",
    show: "Game of Thrones",
    season: 3,
    number: 9,
    airDate: "2013-06-02",
    rating: "TV-MA",
  },
  {
    episode: "Face Off",
    show: "Breaking Bad",
    season: 4,
    number: 13,
    airDate: "2011-10-09",
    rating: "TV-MA",
  },
  {
    episode: "Battle of the Bastards",
    show: "Game of Thrones",
    season: 6,
    number: 9,
    airDate: "2016-06-19",
    rating: "TV-MA",
  },
  {
    episode: "Felina",
    show: "Breaking Bad",
    season: 5,
    number: 16,
    airDate: "2013-09-29",
    rating: "TV-MA",
  },
];

const TV_SHOWS_DIR = "/assets/marketplace/tv-shows";

const SHOW_LOGO_FILE: Record<string, string> = {
  "Breaking Bad": "bb-logo.webp",
  "Game of Thrones": "got.webp",
};

/** The show's logo for its episode rows, or `undefined` for a show with none yet. */
export function tvShowLogoUrl(show: string): string | undefined {
  const file = SHOW_LOGO_FILE[show];
  return file ? `${TV_SHOWS_DIR}/${file}` : undefined;
}

/** The promo banner beneath the menu tiles, in the same slot a sixth tile would sit. */
export const TV_SHOWS_PROMO = {
  image: `${TV_SHOWS_DIR}/bb-ad.webp`,
  alt: "Breaking Bad Habits — Keep Litter Out of Our Territory",
};
