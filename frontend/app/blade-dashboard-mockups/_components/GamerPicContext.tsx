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
 * The shared state of the gamer picture that the user selected.
 * `GamerPicPicker` writes it. Each other part of the blade, such as the
 * header and the sign-out row, reads it with `useGamerPic()` and does not
 * pass it through the props of the profile card, which the server
 * renders.
 *
 * The persistence model: `selected` holds only an explicit selection of
 * the user. A value of null means that the user selected nothing, thus a
 * caller uses its own default. The code writes to localStorage in
 * `setSelected` and never from a mount effect. Thus the double effect of
 * Strict Mode and the handover from SSR to hydration cannot replace a
 * stored value with a default.
 */
export interface GamerPicContextValue {
  /** The public path of the selected image, such as "/profile_pics/monkey.png". It is null when the user selected nothing. */
  selected: string | null;
  setSelected: (src: string | null) => void;
  /** False until the client reads the stored value. Use it to prevent a flash of the default. */
  hydrated: boolean;
}

const GamerPicContext = createContext<GamerPicContextValue | null>(null);

export function GamerPicProvider({
  initial = null,
  children,
}: {
  initial?: string | null;
  children: React.ReactNode;
}) {
  const [selected, setSelectedState] = useState<string | null>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Read on mount only. The code cannot read localStorage during a
  // render: SSR and a static prerender have no window, and the values
  // would not match at the hydration.
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

  // The write occurs here, and only after an action of the user.
  const setSelected = useCallback((src: string | null) => {
    setSelectedState(src);
    try {
      if (src) window.localStorage.setItem(STORAGE_KEY, src);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore a failure of the write.
    }
  }, []);

  const value = useMemo(
    () => ({ selected, setSelected, hydrated }),
    [selected, setSelected, hydrated],
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
