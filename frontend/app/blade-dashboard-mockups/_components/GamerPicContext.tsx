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
 * Shared "which gamerpic did the user pick" state. `GamerPicPicker` writes
 * to it; anything else on the blade (header, sign-out row, etc.) can read
 * it via `useGamerPic()` without prop-drilling through the server-rendered
 * profile card.
 *
 * Persistence model: `selected` is ONLY what the user explicitly chose
 * (null = never picked → callers fall back to their own default). We write
 * to localStorage inside `setSelected` — never from a mount effect — so
 * that Strict Mode's double effect run and the SSR→hydration handoff can't
 * clobber a stored value with a default.
 */
export interface GamerPicContextValue {
  /** Public path of the picked image (e.g. "/profile_pics/monkey.png"), or null if the user never picked one. */
  selected: string | null;
  setSelected: (src: string | null) => void;
  /** False until the stored value has been read on the client. Use it to avoid flashing a default. */
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

  // Read-only on mount. Can't read localStorage during render (SSR / static
  // prerender has no window and would mismatch on hydration).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedState(stored);
    } catch {
      // localStorage unavailable (private mode, etc.) — memory only.
    }
    setHydrated(true);
  }, []);

  // Write happens here, on explicit user action only.
  const setSelected = useCallback((src: string | null) => {
    setSelectedState(src);
    try {
      if (src) window.localStorage.setItem(STORAGE_KEY, src);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore write failures
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
