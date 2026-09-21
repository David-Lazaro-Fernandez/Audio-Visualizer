"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A scrolling column with the console's "more below" cue: a small
 * down-pointing triangle under the column's right edge while the content
 * runs past the bottom. The scrollbar itself is hidden — the arrow and the
 * cursor (focus scrolls tiles into view) do its job in a 10-foot UI.
 *
 * `footer` renders on the left of the arrow's row — the Audiobooks list's
 * "1 of 273" counter sits there, level with the arrow, as on the console.
 */
export function ScrollColumn({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  };

  // Content and viewport can both change size: re-measure after every
  // render (setState bails out when nothing changed) and on resize.
  useEffect(update);
  useEffect(() => {
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        onScroll={update}
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="flex min-h-6 shrink-0 items-center justify-between pr-5">
        <div className="min-w-0">{footer}</div>
        <span aria-hidden="true" className="flex shrink-0 items-center">
          {more && (
            <span className="block h-0 w-0 border-x-[10px] border-t-[12px] border-x-transparent border-t-(--blade-glyph)" />
          )}
        </span>
      </div>
    </div>
  );
}
