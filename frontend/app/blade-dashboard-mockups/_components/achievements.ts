import { HALO3_ACHIEVEMENTS } from "./halo3-achievements";
import { MCLA_ACHIEVEMENTS } from "./mcla-achievements";
import { MW3_ACHIEVEMENTS } from "./mw3-achievements";

/**
 * Data for the Achievements screen (DESIGN.md §6.10): the titles the
 * signed-in gamer has achievements in, and each title's achievement list.
 *
 * Modern Warfare 3, Halo 3 and Midnight Club: Los Angeles are the real
 * lists (`mw3-achievements.ts`, `halo3-achievements.ts`,
 * `mcla-achievements.ts`: 76, 79 and 55 achievements with their 64 px art
 * under `public/assets/achievements/`); which of them are unlocked is
 * mock, carried as `unlocked` on each scraped entry. Only achievements
 * with art are listed, since the icons are full-colour bitmaps not redrawn
 * in the menu-icon finish (§6.2); a title with no scraped list is left out
 * rather than shown as an empty grid.
 *
 * "All Games" is not a title of its own: `allGames()` folds every title's
 * list into one so the screen can show it through the same summary + grid.
 */
export interface Achievement {
  name: string;
  /** How to earn it; read out with the name and kept for the detail screen. */
  description?: string;
  /** Gamerscore the achievement is worth. */
  score: number;
  /** Unlocked achievements show their art; locked ones are an empty tile. */
  unlocked: boolean;
  /** Achievement art under `public/assets/`. Required: no art, no entry. */
  image: string;
}

export interface AchievementGame {
  title: string;
  /** Title artwork under `public/assets/`; placeholder until provided. */
  image?: string;
  achievements: Achievement[];
}

export const ALL_GAMES_TITLE = "All Games";

/** A scraped list (`img` / `gamerPoints` / `unlocked`) as the screen's `Achievement`s. */
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

/** The "All Games" view: every title's achievements in one list. */
export function allGames(games: AchievementGame[]): AchievementGame {
  return {
    title: ALL_GAMES_TITLE,
    achievements: games.flatMap((game) => game.achievements),
  };
}

/** "N achievements" and the earned / total Gamerscore for a title (or for All Games). */
export function achievementTotals(game: AchievementGame) {
  const total = game.achievements.reduce((sum, a) => sum + a.score, 0);
  const earned = game.achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.score, 0);
  return { count: game.achievements.length, earned, total };
}
