/**
 * The signed-in gamer (DESIGN.md §6.3). One profile is shared by every
 * blade: the Games card and the Xbox LIVE card show different rows of it
 * (Games / Gamerscore / Achievements vs. Rep / Gamerscore / Zone), but the
 * gamertag, gamer picture, online badge and Gamerscore are the same
 * person's, so they live here once rather than being typed per blade.
 */
export interface GamerProfile {
  gamertag: string;
  /**
   * Public path of the gamer picture shown until the user picks another in
   * the "Change Gamer Picture" screen; the pick itself is shared live by
   * `GamerPicContext`, so every card changes together.
   */
  gamerpic: string;
  /** Signed in to Xbox LIVE: the card header shows the profile silhouette. */
  online: boolean;
  games: number;
  score: number;
  achievements: number;
  /** Xbox LIVE reputation, 0–5 stars. */
  rep: number;
  /** Xbox LIVE gamer zone: Recreation, Family, Pro or Underground. */
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
