"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A scrolling column with the more-below cue of the console: a small
 * down-pointing triangle below the right edge of the column while the
 * content continues past the bottom. The scrollbar is hidden. In a
 * 10-foot UI the arrow and the cursor do its work, because a focus
 * scrolls a tile into view.
 *
 * `footer` renders at the left of the row of the arrow. The "1 of 273"
 * counter of the Music Library list is there, level with the arrow, as
 * on the console.
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

  // The content and the viewport can both change size. Measure again
  // after each render and at each resize. `setState` does nothing when
  // the value did not change.
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
