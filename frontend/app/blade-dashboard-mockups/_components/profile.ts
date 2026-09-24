/**
 * The signed-in gamer (DESIGN.md §6.3). Each blade uses one profile. The
 * Games card and the Xbox LIVE card show different rows of it, which are
 * Games, Gamerscore and Achievements against Rep, Gamerscore and Zone.
 * But the gamertag, the gamer picture, the online badge and the
 * Gamerscore belong to the same person, thus they are here one time and
 * not in each blade.
 *
 * `PROFILE` is the identity every card falls back to. Picking one of the
 * `SIGN_IN_PROFILES` rows in the Sign In drawer (§6.22) can replace the
 * gamertag and the gamer picture app-wide, through
 * `SignedInProfileContext` — the same idea as `GamerPicContext` below,
 * one context per thing the console lets the user actually change. The
 * stat rows (games, score, achievements, rep, zone) and the online flag
 * stay `PROFILE`'s own: the two mock Sign In accounts carry no stats of
 * their own, so switching identity only ever swaps the name and the
 * face, never the numbers.
 */
export interface GamerProfile {
  gamertag: string;
  /**
   * The public path of the gamer picture. A card shows it until the user
   * selects another picture in the Change Gamer Picture screen.
   * `GamerPicContext` shares that selection, thus each card changes at
   * the same time. `SignedInProfileContext` supplies a different default
   * than `PROFILE.gamerpic` once the user signs in as one of the
   * `SIGN_IN_PROFILES`; an explicit `GamerPicContext` pick still wins
   * over either default.
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

/** One local profile the Sign In drawer's rows list (DESIGN.md §6.22). */
export interface SignInProfile {
  gamertag: string;
  account: string;
  storage: "HDD" | "Memory Unit" | "USB";
  gamerpic: string;
}

/**
 * Two local profiles, as the console's own Sign In screen lists whatever
 * profiles are saved on the console. The console's own gamerpics for
 * these two accounts were a Bungie logo and an iron cross — real marks
 * that do not belong redrawn in this codebase — so two of the generic
 * gamerpics already in `public/profile_pics` (the set `GamerPicPicker`
 * itself offers) stand in.
 *
 * This lives here and not in `ConnectXboxLiveDrawer.tsx`, because
 * `SignedInProfileContext` also needs it: it resolves the gamertag the
 * drawer's rows chose back to a full profile, so both the drawer and
 * the context read the same two mock accounts rather than keeping a
 * second copy of them in sync by hand.
 */
export const SIGN_IN_PROFILES: SignInProfile[] = [
  {
    gamertag: "DavidTheLord",
    account: "Xbox LIVE",
    storage: "HDD",
    gamerpic: "/profile_pics/20000.png",
  },
  {
    gamertag: "x Snow Wolf x",
    account: "Xbox LIVE",
    storage: "HDD",
    gamerpic: "/profile_pics/20002.png",
  },
];
