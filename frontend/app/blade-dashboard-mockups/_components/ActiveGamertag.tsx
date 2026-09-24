"use client";

import { useActiveProfile } from "./SignedInProfileContext";

/**
 * The gamertag in a `GamerProfileCard` header (DESIGN.md §6.3). It is
 * the one piece of that card that has to be a client leaf: the header
 * is otherwise server-rendered from the static `profile` prop, but the
 * name itself must follow whichever `SIGN_IN_PROFILES` row the Sign In
 * drawer signed in as (§6.22), through `useActiveProfile`, the same way
 * `GamerPicPicker` already reads `GamerPicContext` for the picture
 * beside it rather than taking it as a fixed prop.
 */
export function ActiveGamertag({ className }: { className?: string }) {
  const { gamertag } = useActiveProfile();
  return <span className={className}>{gamertag}</span>;
}
