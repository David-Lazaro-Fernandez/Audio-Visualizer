/**
 * The Xbox LIVE reputation readout on the profile card (DESIGN.md §6.3):
 * five stars, `filled` of them lit. Lit stars share the glossy yellow of
 * the Y button (§2.3, `#CBD527` family) with a darker edge so they sit on
 * the card's white shine; unlit ones are the same shape in the card's
 * neutral gray, since disabled ≠ hidden (§7.2). Plain SVG so it renders on
 * the server and passes into the card as a stat value.
 */
export function RepStars({
  filled = 5,
  total = 5,
  sizePx = 22,
}: {
  filled?: number;
  total?: number;
  sizePx?: number;
}) {
  return (
    <span
      role="img"
      aria-label={`Rep ${filled} of ${total} stars`}
      className="flex items-center gap-[4px]"
    >
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} index={i} lit={i < filled} sizePx={sizePx} />
      ))}
    </span>
  );
}

const STAR_PATH =
  "M12 2.2l2.95 6.3 6.85.8-5.05 4.7 1.35 6.8L12 17.4l-6.1 3.4 1.35-6.8L2.2 9.3l6.85-.8z";

function Star({
  index,
  lit,
  sizePx,
}: {
  index: number;
  lit: boolean;
  sizePx: number;
}) {
  // One gradient per star so the ids stay unique in the document.
  const gradId = `rep-star-${index}-${lit ? "lit" : "dim"}`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={sizePx}
      height={sizePx}
      className="shrink-0"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          {lit ? (
            <>
              <stop offset="0" stopColor="#fdf3a1" />
              <stop offset="0.5" stopColor="#f2dc2e" />
              <stop offset="1" stopColor="#d3b40f" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ececec" />
              <stop offset="1" stopColor="#bdbdbd" />
            </>
          )}
        </linearGradient>
      </defs>
      <path
        d={STAR_PATH}
        fill={`url(#${gradId})`}
        stroke={lit ? "#8a7208" : "#9B9B9B"}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
