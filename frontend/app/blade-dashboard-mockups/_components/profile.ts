/**
 * The signed-in gamer (DESIGN.md §6.3). Each blade uses one profile. The
 * Games card and the Xbox LIVE card show different rows of it, which are
 * Games, Gamerscore and Achievements against Rep, Gamerscore and Zone.
 * But the gamertag, the gamer picture, the online badge and the
 * Gamerscore belong to the same person, thus they are here one time and
 * not in each blade.
 */
export interface GamerProfile {
  gamertag: string;
  /**
   * The public path of the gamer picture. A card shows it until the user
   * selects another picture in the Change Gamer Picture screen.
   * `GamerPicContext` shares that selection, thus each card changes at
   * the same time.
   */
  gamerpic: string;
  /** The gamer is signed in to Xbox LIVE. The card header then shows the profile silhouette. */
  online: boolean;
  games: number;
  score: number;
  achievements: number;
  /** The Xbox LIVE reputation, from 0 to 5 stars. */
  rep: number;
  /** The Xbox LIVE gamer zone: Recreation, Family, Pro or Underground. */
  zone: string;
}

export const PROFILE: GamerProfile = {
  gamertag: "DavidTheLord",
  gamerpic: "/profile_pics/20000.png",
  online: true,
  games: 0,
  score: 21117,
  achievements: 0,
  rep: 5,
  zone: "Pro",
};
