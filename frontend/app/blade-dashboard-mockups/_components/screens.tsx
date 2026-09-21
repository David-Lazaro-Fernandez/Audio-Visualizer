import type { MenuScreenProps } from "./MenuListItem";
import { AchievementsScreen } from "./AchievementsScreen";
import { AudiobooksScreen } from "./AudiobooksScreen";
import { GamesLibraryScreen } from "./GamesLibraryScreen";
import { MusicScreen } from "./MusicScreen";
import { MyGamesScreen } from "./MyGamesScreen";
import { PicturesScreen } from "./PicturesScreen";

/**
 * Full-screen destinations a menu row can open. Rows reference them by key
 * (`screen: "games-library"`) so the page can stay a server component and
 * pass plain data; `LibraryMenu` resolves the key to a component at render
 * time. Resolving lazily (a function, not a module-level map) keeps the
 * import cycle screens → GamesLibraryScreen → LibraryMenu → screens
 * harmless: nothing is dereferenced while modules are still loading.
 *
 * Screens stack: Games blade → "games-library" → "my-games". The blade's
 * Achievements row opens "achievements" directly. Media blade → "music" →
 * "audiobooks" (from the Music screen's Hard Drive row); the Media blade's
 * Pictures row opens "pictures" directly.
 */
export type ScreenKey =
  | "games-library"
  | "my-games"
  | "achievements"
  | "music"
  | "audiobooks"
  | "pictures";

export function resolveScreen(key: ScreenKey): React.ComponentType<MenuScreenProps> {
  switch (key) {
    case "games-library":
      return GamesLibraryScreen;
    case "my-games":
      return MyGamesScreen;
    case "achievements":
      return AchievementsScreen;
    case "music":
      return MusicScreen;
    case "audiobooks":
      return AudiobooksScreen;
    case "pictures":
      return PicturesScreen;
  }
}
