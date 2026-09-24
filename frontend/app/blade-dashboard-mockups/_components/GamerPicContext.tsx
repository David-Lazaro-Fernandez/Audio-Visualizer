"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "blade-dashboard:gamerpic";

/**
 * The shared state of the gamer picture each profile selected, keyed by
 * gamertag. `GamerPicPicker` writes it, for whichever gamertag
 * `useActiveProfile` (`SignedInProfileContext.tsx`) currently resolves
 * to. Each other part of the blade, such as the header and the sign-out
 * row, reads it through `useActiveProfile` and does not pass it through
 * the props of the profile card, which the server renders.
 *
 * A map and not one value, because there is more than one profile to
 * sign in as (§6.22) and each keeps its own picture on a real console —
 * a single `selected` here, as an earlier version had, could not tell
 * "DavidTheLord picked this" from "x Snow Wolf x picked that" and
 * overwrote one profile's picture with whichever was chosen last,
 * regardless of who was signed in at the time.
 *
 * The persistence model: `selections` holds only the gamertags the user
 * has explicitly picked a picture for. A gamertag with no entry means
 * that its profile kept its own default, thus a caller falls back to
 * that default (`SIGN_IN_PROFILES`' own `gamerpic`, or `PROFILE`'s for
 * the base identity). The code writes to localStorage in `setSelected`
 * and never from a mount effect. Thus the double effect of Strict Mode
 * and the handover from SSR to hydration cannot replace a stored value
 * with a default.
 */
export interface GamerPicContextValue {
  /** The public path of the picture each gamertag picked, such as `{ DavidTheLord: "/profile_pics/monkey.png" }`. A gamertag with no entry picked nothing. */
  selections: Record<string, string>;
  setSelected: (gamertag: string, src: string) => void;
  /** False until the client reads the stored value. Use it to prevent a flash of the default. */
  hydrated: boolean;
}

const GamerPicContext = createContext<GamerPicContextValue | null>(null);

export function GamerPicProvider({ children }: { children: React.ReactNode }) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // Read on mount only. The code cannot read localStorage during a
  // render: SSR and a static prerender have no window, and the values
  // would not match at the hydration.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSelections(JSON.parse(stored));
    } catch {
      // localStorage is not available (private mode), or the stored
      // value predates this map shape. Keep the value in memory only.
    }
    setHydrated(true);
  }, []);

  // The write occurs here, and only after an action of the user.
  const setSelected = useCallback((gamertag: string, src: string) => {
    setSelections((prev) => {
      const next = { ...prev, [gamertag]: src };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore a failure of the write.
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ selections, setSelected, hydrated }),
    [selections, setSelected, hydrated],
  );

  return <GamerPicContext.Provider value={value}>{children}</GamerPicContext.Provider>;
}

export function useGamerPic(): GamerPicContextValue {
  const ctx = useContext(GamerPicContext);
  if (!ctx) {
    throw new Error("useGamerPic must be used inside <GamerPicProvider>");
  }
  return ctx;
}
