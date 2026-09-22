import { HALO3_ACHIEVEMENTS } from "./halo3-achievements";
import { MCLA_ACHIEVEMENTS } from "./mcla-achievements";
import { MW3_ACHIEVEMENTS } from "./mw3-achievements";

/**
 * The data of the Achievements screen (DESIGN.md §6.10): the titles that
 * the signed-in gamer has achievements in, and the achievement list of
 * each title.
 *
 * Modern Warfare 3, Halo 3 and Midnight Club: Los Angeles are the real
 * lists (`mw3-achievements.ts`, `halo3-achievements.ts` and
 * `mcla-achievements.ts`, with 76, 79 and 55 achievements and their
 * 64 px art under `public/assets/achievements/`). The unlocked state is
 * mock data and is the `unlocked` field of each scraped entry. The
 * screen lists only an achievement that has art, because the icons are
 * full-colour bitmaps and are not redrawn in the menu-icon finish
 * (§6.2). A title with no scraped list is not in the screen, because an
 * empty grid is not acceptable.
 *
 * "All Games" is not a title. `allGames()` folds the list of each title
 * into one list, thus the screen shows it through the same summary and
 * the same grid.
 */
export interface Achievement {
  name: string;
  /** How to earn the achievement. The summary shows it with the name, and the detail screen keeps it. */
  description?: string;
  /** The Gamerscore of the achievement. */
  score: number;
  /** An unlocked achievement shows its art. A locked achievement is an empty tile. */
  unlocked: boolean;
  /** The achievement art, under `public/assets/`. It is necessary: an entry with no art is not listed. */
  image: string;
}

export interface AchievementGame {
  title: string;
  /** The title artwork, under `public/assets/`. The screen shows the placeholder until the art is available. */
  image?: string;
  achievements: Achievement[];
}

export const ALL_GAMES_TITLE = "All Games";

/** Converts a scraped list, with `img`, `gamerPoints` and `unlocked`, to the `Achievement`s of the screen. */
function fromScraped(
  entries: {
    img: string;
    name: string;
    description: string;
    gamerPoints: number;
    unlocked: boolean;
  }[],
): Achievement[] {
  return entries.map((entry) => ({
    name: entry.name,
    description: entry.description,
    score: entry.gamerPoints,
    unlocked: entry.unlocked,
    image: entry.img,
  }));
}

export const ACHIEVEMENT_GAMES: AchievementGame[] = [
  {
    title: "Call of Duty: Modern Warfare 3",
    image: "/assets/games_pics/cod_mw3.png",
    achievements: fromScraped(MW3_ACHIEVEMENTS),
  },
  {
    title: "Halo 3",
    image: "/assets/games_pics/halo_3.png",
    achievements: fromScraped(HALO3_ACHIEVEMENTS),
  },
  {
    title: "Midnight Club: Los Angeles",
    image: "/assets/games_pics/midnight_club_la.png",
    achievements: fromScraped(MCLA_ACHIEVEMENTS),
  },
];

/** The "All Games" view: the achievements of each title in one list. */
export function allGames(games: AchievementGame[]): AchievementGame {
  return {
    title: ALL_GAMES_TITLE,
    achievements: games.flatMap((game) => game.achievements),
  };
}

/** The count of achievements and the earned and total Gamerscore of a title, or of All Games. */
export function achievementTotals(game: AchievementGame) {
  const total = game.achievements.reduce((sum, a) => sum + a.score, 0);
  const earned = game.achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.score, 0);
  return { count: game.achievements.length, earned, total };
}
