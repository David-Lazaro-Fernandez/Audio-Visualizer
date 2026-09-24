import type { MenuScreenProps } from "./MenuListItem";
import { AchievementsScreen } from "./AchievementsScreen";
import { MusicLibraryScreen } from "./MusicLibraryScreen";
import { ConsoleSettingsScreen } from "./ConsoleSettingsScreen";
import { GamesLibraryScreen } from "./GamesLibraryScreen";
import { GameStoreScreen } from "./GameStoreScreen";
import { MusicScreen } from "./MusicScreen";
import { MyGamesScreen } from "./MyGamesScreen";
import { PicturesScreen } from "./PicturesScreen";
import { PictureBrowserScreen } from "./PictureBrowserScreen";
import { GenresScreen } from "./GenresScreen";
import {
  GameStoreListScreen,
  NewArrivalsScreen,
  SpotlightScreen,
} from "./SpotlightScreen";
import { TvShowsScreen } from "./TvShowsScreen";
import { XboxOriginalsScreen } from "./XboxOriginalsScreen";
import { ConnectXboxLiveDrawer } from "./ConnectXboxLiveDrawer";

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
 * directly. The Media blade opens "music", and the Music Player row of the
 * Music screen opens "music-library". The Pictures row of the Media blade
 * opens "pictures" directly, whose Computer row opens "picture-browser"
 * (§6.13.1). The Console Settings row of the System blade opens
 * "console-settings". The Spotlight, New Arrivals, Game Store and
 * Video Store tiles of the Marketplace blade open "spotlight",
 * "new-arrivals", "game-store-list" and "tv-shows" directly; the
 * Game Store's own Xbox Originals tile opens "xbox-originals", and
 * the TV Shows screen's own Genres tile opens "genres". "game-store"
 * still resolves to the tile-based Game Store screen (§6.19.1), but
 * nothing links to it any more: the blade's own Game Store tile opens
 * "game-store-list" instead (§6.20), which is `SpotlightScreen` under
 * another title. The Xbox LIVE blade's own Connect row opens
 * "connect-live" (§6.22), a drawer rather than a full-screen surface,
 * through this same mechanism.
 *
 * Some screens cannot be here. A key names a destination that exists one
 * time. The album screen (§6.14) and the song screen (§6.15) exist one
 * time for each album and for each track, and the picture viewer (§6.13.2)
 * exists one time for each picture. Thus their rows pass a component that
 * is bound to their data. Refer to `LibraryMenuItem.screen`, which accepts
 * both forms.
 */
export type ScreenKey =
  | "games-library"
  | "my-games"
  | "achievements"
  | "music"
  | "music-library"
  | "pictures"
  | "picture-browser"
  | "console-settings"
  | "spotlight"
  | "new-arrivals"
  | "game-store"
  | "game-store-list"
  | "xbox-originals"
  | "tv-shows"
  | "genres"
  | "connect-live";

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
    case "music-library":
      return MusicLibraryScreen;
    case "pictures":
      return PicturesScreen;
    case "picture-browser":
      return PictureBrowserScreen;
    case "console-settings":
      return ConsoleSettingsScreen;
    case "spotlight":
      return SpotlightScreen;
    case "new-arrivals":
      return NewArrivalsScreen;
    case "game-store":
      return GameStoreScreen;
    case "game-store-list":
      return GameStoreListScreen;
    case "xbox-originals":
      return XboxOriginalsScreen;
    case "tv-shows":
      return TvShowsScreen;
    case "genres":
      return GenresScreen;
    case "connect-live":
      return ConnectXboxLiveDrawer;
  }
}
