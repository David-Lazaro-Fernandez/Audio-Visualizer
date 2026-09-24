"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PROFILE, SIGN_IN_PROFILES, type GamerProfile } from "./profile";
import { useGamerPic } from "./GamerPicContext";

const STORAGE_KEY = "blade-dashboard:signed-in-profile";

/**
 * Which of the two `SIGN_IN_PROFILES` the Sign In drawer's rows chose
 * (DESIGN.md §6.22), the same shape as `GamerPicContext`: a gamertag, or
 * null before any explicit choice, written only from a row's own click
 * and never from a mount effect, so the double effect of Strict Mode and
 * the SSR-to-hydration handover cannot stomp a stored choice with the
 * default.
 */
export interface SignedInProfileContextValue {
  /** The gamertag of the chosen `SIGN_IN_PROFILES` entry, or null when the user has not signed in as one yet. */
  selected: string | null;
  setSelected: (gamertag: string | null) => void;
  /** False until the client reads the stored value. Use it to prevent a flash of the wrong identity. */
  hydrated: boolean;
}

const SignedInProfileContext = createContext<SignedInProfileContextValue | null>(null);

export function SignedInProfileProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelectedState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read on mount only, for the reason `GamerPicContext` does: there is
  // no window during SSR or a static prerender, so the value cannot be
  // read during a render.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedState(stored);
    } catch {
      // localStorage is not available, for example in private mode. Keep
      // the value in memory only.
    }
    setHydrated(true);
  }, []);

  const setSelected = useCallback((gamertag: string | null) => {
    setSelectedState(gamertag);
    try {
      if (gamertag) window.localStorage.setItem(STORAGE_KEY, gamertag);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore a failure of the write.
    }
  }, []);

  const value = useMemo(
    () => ({ selected, setSelected, hydrated }),
    [selected, setSelected, hydrated],
  );

  return (
    <SignedInProfileContext.Provider value={value}>{children}</SignedInProfileContext.Provider>
  );
}

export function useSignedInProfile(): SignedInProfileContextValue {
  const ctx = useContext(SignedInProfileContext);
  if (!ctx) {
    throw new Error("useSignedInProfile must be used inside <SignedInProfileProvider>");
  }
  return ctx;
}

/**
 * The profile every card should actually show: `PROFILE` until the user
 * picks a row in the Sign In drawer, then that row's gamertag and
 * picture over `PROFILE`'s own stats and online flag (`profile.ts`
 * explains why only the identity swaps). Every reader of the active
 * gamertag or gamer picture — the profile card, the picture picker, the
 * controller sign-in toast — calls this instead of importing `PROFILE`
 * directly, so a sign-in cannot update one of them and miss another.
 *
 * The picture also folds in `GamerPicContext`'s own per-gamertag pick,
 * so this is the *one* place that resolves what picture is actually on
 * screen: without it, a picture chosen through the pencil icon on the
 * profile card kept showing there while the Sign In drawer's own row for
 * that same profile still drew its hardcoded default, since the drawer
 * had no way to know a customization existed. A `GamerPicContext` pick
 * for the *active* gamertag still wins over that row's default
 * `gamerpic`, exactly as `profile.ts` documents; a pick for the other
 * mock profile has no effect here; `ConnectXboxLiveDrawer` looks that
 * one up on its own, straight from `GamerPicContext`, since a row that
 * is not the active profile is never what this hook resolves to.
 */
export function useActiveProfile(): GamerProfile {
  const { selected } = useSignedInProfile();
  const { selections } = useGamerPic();
  const chosen = SIGN_IN_PROFILES.find((profile) => profile.gamertag === selected);
  const identity = chosen ?? PROFILE;
  return {
    ...PROFILE,
    gamertag: identity.gamertag,
    gamerpic: selections[identity.gamertag] ?? identity.gamerpic,
  };
}
