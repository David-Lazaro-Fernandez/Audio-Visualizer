"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { MenuListItem, type MenuScreenProps } from "./MenuListItem";
import { resolveScreen, type ScreenKey } from "./screens";

export interface LibraryMenuItem {
  label: string;
  meta?: string;
  variant?: "row" | "button" | "brand";
  disabled?: boolean;
  /** Grey as `disabled` is, but still a cursor stop. Refer to `MenuListItem`. */
  unavailable?: boolean;
  detailTitle?: string;
  detail?: React.ReactNode;
  /**
   * The full-screen destination that Select opens. It has priority over
   * `detail`.
   *
   * It is usually a key from `screens.tsx`, thus the page can stay a
   * server component and pass plain data. A screen that needs arguments,
   * such as the album screen, which exists one time for each album,
   * cannot have a name as a string. Thus this prop also accepts a bound
   * component.
   */
  screen?: ScreenKey | React.ComponentType<MenuScreenProps>;
  icon?: React.ReactNode;
  /** The text that the pane beside the menu shows while this row is highlighted. */
  description?: string;
  /**
   * The title that the pane shows above the text (`showTitle`) when that
   * title must be different from the label of the row. The pane
   * describes the "Connect to Xbox LIVE" row of the Xbox LIVE blade
   * under the heading "Xbox LIVE".
   */
  descriptionTitle?: string;
  /** The action of a row with no `detail` and no `screen`, such as a row that launches a game. Refer to `MenuListItem`. */
  onSelect?: () => void;
  /** `rows` layout: a right-pointing chevron at the end of the row while the cursor is on it. Refer to `MenuListItem`. */
  chevron?: boolean;
}

/** What the description pane must know about the highlighted row. */
export type HighlightedItem = Pick<
  LibraryMenuItem,
  "label" | "description" | "descriptionTitle"
>;

/**
 * The row that the cursor is on. The menu and the description pane
 * beside it share this state. The console shows the text of the
 * highlighted item at the right, for example "Track your gaming
 * accomplishments." The menu and the pane are two grid cells of the
 * page, thus the state is in a context above them and not in one of
 * them. The providers nest: a full-screen menu mounts its own provider,
 * thus its rows drive its own pane and not the pane of the blade behind
 * it.
 */
interface HighlightValue {
  item: HighlightedItem | null;
  setItem: (item: HighlightedItem | null) => void;
}

const HighlightContext = createContext<HighlightValue | null>(null);

/**
 * The row that the cursor is on, for a pane that is not
 * `LibraryMenuDescription`, such as the "1 of 6" counter and the detail
 * panel of My Games. It is null when no provider is mounted, and null
 * until the cursor lands on a row.
 */
export function useHighlightedItem(): HighlightedItem | null {
  return useContext(HighlightContext)?.item ?? null;
}

export function LibraryMenuProvider({
  initialItem = null,
  children,
}: {
  /** What the pane shows before the cursor lands on a row. It is usually the first live row. */
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
 * A list such as "My library / Achievements / Friends / Friends playing
 * now" is a navigable menu (DESIGN.md §6.2). Thus it is an
 * <aside><nav><ul> and not a stack of <div>s.
 *
 * `layout="rows"`, the default, is the divider-separated list of the
 * blade. `layout="buttons"` is the stack of raised buttons with gaps
 * that a full-screen menu uses, such as the Games Library. In that
 * layout a row uses the `button` variant by default.
 *
 * `iconOnly`, in the rows layout, draws each row as its icon only, with
 * a label for assistive technology. The column of title art on the
 * Achievements screen uses it.
 *
 * `autoFocusFirst` puts the keyboard cursor on the first row at the page
 * load, as the console highlights a default item. Each row is a
 * `data-nav-item`. The caller owns the `data-nav-list` around the menu,
 * thus the cursor can move from an adjacent item, such as the gamer
 * picture, into this menu in one column. A hover or a focus on a row
 * publishes it to `LibraryMenuProvider`, if a provider is mounted.
 *
 * `className` styles the `<aside>`. The Music screen paints its source
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
  /** `rows` layout: make the icon and the label of the highlighted row larger. Refer to `MenuListItem`. */
  growOnFocus?: boolean;
  /** `rows` layout: rows with an icon only. The label stays as the `aria-label`. Refer to `MenuListItem`. */
  iconOnly?: boolean;
  /** `buttons` layout: raised rows with one band, as in a browse list. Refer to `MenuListItem`. */
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
 * The text beside the menu. It follows the row that the cursor is on.
 * `showTitle` adds the label of the row above the text, as the Games
 * Library does with "My Games" and "You have 1 game on your console".
 * It uses the `descriptionTitle` of the row when the row sets one.
 * `children` render between the title and the text, such as the source
 * artwork of the Music screen (§6.11).
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
