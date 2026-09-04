"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { MenuListItem } from "./MenuListItem";

export interface LibraryMenuItem {
  label: string;
  meta?: string;
  variant?: "row" | "button" | "brand";
  disabled?: boolean;
  detailTitle?: string;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  /** One-liner shown in the pane beside the menu while this row is highlighted. */
  description?: string;
}

/**
 * "Which row is the cursor on" — shared between the menu and the
 * description pane beside it (the 360's Games blade shows the highlighted
 * item's blurb to the right: "Track your gaming accomplishments."). Both
 * are grid cells of the page, so the state lives in a context above them
 * rather than in either one.
 */
interface HighlightValue {
  description: string | null;
  setDescription: (description: string | null) => void;
}

const HighlightContext = createContext<HighlightValue | null>(null);

export function LibraryMenuProvider({
  initialDescription = null,
  children,
}: {
  /** What the pane shows before the cursor has landed on anything — usually row 0's. */
  initialDescription?: string | null;
  children: React.ReactNode;
}) {
  const [description, setDescription] = useState<string | null>(initialDescription);
  const value = useMemo(() => ({ description, setDescription }), [description]);
  return <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>;
}

/**
 * "My library / Achievements / Friends / Friends playing now" is a
 * navigable menu (DESIGN.md §6.2), so it belongs in an <aside><nav><ul>
 * rather than a plain stack of <div>s.
 *
 * `autoFocusFirst` drops the keyboard cursor on the first row when the page
 * loads, like the 360's highlighted default item. The rows are
 * `data-nav-item`s; the enclosing `data-nav-list` is left to the caller so
 * the cursor can travel from neighbouring items (e.g. the gamerpic) into
 * this menu in one column. Hovering or focusing a row publishes its
 * `description` to `LibraryMenuProvider` (if one is mounted).
 */
export function LibraryMenu({
  items,
  autoFocusFirst = false,
}: {
  items: LibraryMenuItem[];
  autoFocusFirst?: boolean;
}) {
  const highlight = useContext(HighlightContext);

  return (
    <aside aria-label="Library menu" className="flex min-w-0 flex-col">
      <nav>
        <ul className="flex flex-col">
          {items.map(({ description, ...item }, index) => (
            <li
              key={item.label}
              className="first:border-t-2 first:border-t-[#43AB33] last:[&>button]:border-b-2 last:[&>button]:border-b-[#43AB33]"
            >
              <MenuListItem
                {...item}
                autoFocus={autoFocusFirst && index === 0}
                onHighlight={
                  highlight
                    ? () => highlight.setDescription(description ?? null)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/** The blurb beside the menu; tracks whichever row the cursor is on. */
export function LibraryMenuDescription({ className }: { className?: string }) {
  const highlight = useContext(HighlightContext);
  const text = highlight?.description;
  return (
    <p aria-live="polite" className={className}>
      {text}
    </p>
  );
}
