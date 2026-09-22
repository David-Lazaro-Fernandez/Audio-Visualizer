"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { MenuListItem, type MenuScreenProps } from "./MenuListItem";
import { resolveScreen, type ScreenKey } from "./screens";

export interface LibraryMenuItem {
  label: string;
  meta?: string;
  variant?: "row" | "button" | "brand";
  disabled?: boolean;
  /** Greyed like `disabled` but still a cursor stop; see `MenuListItem`. */
  unavailable?: boolean;
  detailTitle?: string;
  detail?: React.ReactNode;
  /**
   * Full-screen destination opened on select; wins over `detail`.
   *
   * Normally a key from `screens.tsx`, so the page can stay a server
   * component and pass plain data. A screen that needs *arguments* - the
   * album screen, which exists once per album - cannot be named by a
   * string, so a bound component is accepted too.
   */
  screen?: ScreenKey | React.ComponentType<MenuScreenProps>;
  icon?: React.ReactNode;
  /** Blurb shown in the pane beside the menu while this row is highlighted. */
  description?: string;
  /**
   * Title the pane shows above the blurb (`showTitle`) when it should differ
   * from the row label — the Xbox LIVE blade's "Connect to Xbox LIVE" row
   * is described under the heading "Xbox LIVE".
   */
  descriptionTitle?: string;
  /** Action for rows with no `detail`/`screen` (e.g. launch a game); see `MenuListItem`. */
  onSelect?: () => void;
  /** `rows` layout: right-pointing cursor chevron at the row's end; see `MenuListItem`. */
  chevron?: boolean;
}

/** What the description pane needs to know about the highlighted row. */
export type HighlightedItem = Pick<
  LibraryMenuItem,
  "label" | "description" | "descriptionTitle"
>;

/**
 * "Which row is the cursor on" — shared between the menu and the
 * description pane beside it (the 360 shows the highlighted item's blurb to
 * the right: "Track your gaming accomplishments."). Both are grid cells of
 * the page, so the state lives in a context above them rather than in
 * either one. Providers nest: a full-screen menu mounts its own so its rows
 * drive its own pane, not the blade's behind it.
 */
interface HighlightValue {
  item: HighlightedItem | null;
  setItem: (item: HighlightedItem | null) => void;
}

const HighlightContext = createContext<HighlightValue | null>(null);

/**
 * The row the cursor is on, for panes other than `LibraryMenuDescription`
 * that follow it (e.g. My Games' "1 of 6" counter and detail panel). Null
 * when no provider is mounted or nothing is highlighted yet.
 */
export function useHighlightedItem(): HighlightedItem | null {
  return useContext(HighlightContext)?.item ?? null;
}

export function LibraryMenuProvider({
  initialItem = null,
  children,
}: {
  /** What the pane shows before the cursor has landed on anything — usually the first live row. */
  initialItem?: HighlightedItem | null;
  children: React.ReactNode;
}) {
  const [item, setItem] = useState<HighlightedItem | null>(
    initialItem && {
      label: initialItem.label,
      description: initialItem.description,
      descriptionTitle: initialItem.descriptionTitle,
    },
  );
  const value = useMemo(() => ({ item, setItem }), [item]);
  return <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>;
}

/**
 * "My library / Achievements / Friends / Friends playing now" is a
 * navigable menu (DESIGN.md §6.2), so it belongs in an <aside><nav><ul>
 * rather than a plain stack of <div>s.
 *
 * `layout="rows"` (default) is the blade's divider-separated list;
 * `layout="buttons"` is the spaced stack of raised buttons used by
 * full-screen menus like the Games Library (rows default to the `button`
 * variant there).
 *
 * `iconOnly` (rows layout) draws each row as just its icon, labelled for
 * assistive tech only — the Achievements screen's column of title art.
 *
 * `autoFocusFirst` drops the keyboard cursor on the first row when the page
 * loads, like the 360's highlighted default item. The rows are
 * `data-nav-item`s; the enclosing `data-nav-list` is left to the caller so
 * the cursor can travel from neighbouring items (e.g. the gamerpic) into
 * this menu in one column. Hovering or focusing a row publishes it to
 * `LibraryMenuProvider` (if one is mounted).
 *
 * `className` styles the `<aside>` — the Music screen paints its source
 * list on a darker slab (§6.11).
 */
export function LibraryMenu({
  items,
  layout = "rows",
  autoFocusFirst = false,
  growOnFocus = false,
  iconOnly = false,
  compact = false,
  ariaLabel = "Library menu",
  className,
}: {
  items: LibraryMenuItem[];
  layout?: "rows" | "buttons";
  autoFocusFirst?: boolean;
  /** `rows` layout: swell the highlighted row's icon and label (see `MenuListItem`). */
  growOnFocus?: boolean;
  /** `rows` layout: icon-only rows, the label kept as `aria-label` (see `MenuListItem`). */
  iconOnly?: boolean;
  /** `buttons` layout: single-band raised rows (see `MenuListItem`), as in a browse list. */
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const highlight = useContext(HighlightContext);
  const buttons = layout === "buttons";

  return (
    <aside aria-label={ariaLabel} className={`flex min-w-0 flex-col ${className ?? ""}`}>
      <nav>
        <ul className={`flex flex-col ${buttons ? (compact ? "gap-2" : "gap-3") : ""}`}>
          {items.map(({ description, descriptionTitle, screen, variant, ...item }, index) => (
            <li
              key={item.label}
              className={
                buttons
                  ? undefined
                  : "first:border-t-2 first:border-t-(--blade-rule-strong) last:[&>button]:border-b-2 last:[&>button]:border-b-(--blade-rule-strong)"
              }
            >
              <MenuListItem
                {...item}
                variant={variant ?? (buttons ? "button" : "row")}
                screen={
                  typeof screen === "string" ? resolveScreen(screen) : screen
                }
                autoFocus={autoFocusFirst && index === 0}
                growOnFocus={growOnFocus}
                iconOnly={iconOnly}
                compact={compact}
                onHighlight={
                  highlight
                    ? () =>
                        highlight.setItem({
                          label: item.label,
                          description,
                          descriptionTitle,
                        })
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

/**
 * The blurb beside the menu; tracks whichever row the cursor is on.
 * `showTitle` adds the row's label above the text, as the Games Library
 * does ("My Games" / "You have 1 game on your console…"), or the row's own
 * `descriptionTitle` when it sets one. `children` render between the title
 * and the blurb — the Music screen's source artwork (§6.11).
 */
export function LibraryMenuDescription({
  className,
  showTitle = false,
  titleClassName,
  children,
}: {
  className?: string;
  showTitle?: boolean;
  titleClassName?: string;
  children?: React.ReactNode;
}) {
  const highlight = useContext(HighlightContext);
  const item = highlight?.item;
  return (
    <div aria-live="polite" className={className}>
      {showTitle && item?.label && (
        <p className={titleClassName}>{item.descriptionTitle ?? item.label}</p>
      )}
      {children}
      <p>{item?.description}</p>
    </div>
  );
}
