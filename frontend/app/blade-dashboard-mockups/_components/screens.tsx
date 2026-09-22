import type { MenuScreenProps } from "./MenuListItem";
import { AchievementsScreen } from "./AchievementsScreen";
import { AudiobooksScreen } from "./AudiobooksScreen";
import { GamesLibraryScreen } from "./GamesLibraryScreen";
import { MusicScreen } from "./MusicScreen";
import { MyGamesScreen } from "./MyGamesScreen";
import { PicturesScreen } from "./PicturesScreen";

/**
 * The full-screen destinations that a menu row can open. A row names one
 * by key (`screen: "games-library"`), thus the page can stay a server
 * component and pass plain data. `LibraryMenu` then resolves the key to
 * a component at render time. The resolution is lazy, through a function
 * and not a module-level map. Thus the import cycle screens to
 * GamesLibraryScreen to LibraryMenu to screens is safe: nothing reads a
 * value while the modules load.
 *
 * The screens stack. The Games blade opens "games-library", which opens
 * "my-games". The Achievements row of the blade opens "achievements"
 * directly. The Media blade opens "music", and the Hard Drive row of the
 * Music screen opens "audiobooks". The Pictures row of the Media blade
 * opens "pictures" directly.
 *
 * Some screens cannot be here. A key names a destination that exists one
 * time. The album screen (§6.14) and the song screen (§6.15) exist one
 * time for each album and for each track. Thus their rows pass a
 * component that is bound to their data. Refer to
 * `LibraryMenuItem.screen`, which accepts both forms.
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
