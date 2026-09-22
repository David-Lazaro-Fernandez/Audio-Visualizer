const BUTTON_COLORS: Record<"A" | "B" | "X" | "Y", { base: string; text: string }> = {
  X: { base: "#1E5C86", text: "#1a1a1a" },
  A: { base: "#43B039", text: "#1a1a1a" },
  B: { base: "#FA3A2F", text: "#1a1a1a" },
  Y: { base: "#CBD527", text: "#1a1a1a" },
};

/** Mixes `hex` toward white when `amount` is positive, or toward black when it is negative. The range is 0 to 1. */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (channel: number) => Math.round(channel + (target - channel) * t);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `rgb(${r},${g},${b})`;
}

/**
 * DESIGN.md §2.3 and §6.5: a controller button legend always uses the
 * physical button colours, which are green for A, red for B, blue for X
 * and yellow for Y. The glyph is a glossy sphere: a radial-gradient base
 * with two blurred highlight ellipses, a strong one near the top and a
 * thin one near the bottom. Thus it looks like a real button cap and not
 * like a flat colour. With `disabled` the glyph becomes a flat #E2E2E2
 * disc at 70% opacity, with a solid #9B9B9B ring and a darker gray
 * letter. A disabled slot is not a button that a user can press, but it
 * must still identify its button.
 */
export function ButtonGlyph({
  letter,
  sizePx = 26,
  fontSizePx,
  disabled = false,
}: {
  letter: "A" | "B" | "X" | "Y";
  sizePx?: number;
  fontSizePx?: number;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div
        className="relative flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: sizePx,
          height: sizePx,
          background: "rgba(226,226,226,.7)",
          boxShadow: "inset 0 0 0 1px #9B9B9B",
        }}
      >
        <span
          className="font-bold"
          style={{ color: "#8a8a8a", fontSize: fontSizePx ?? Math.round(sizePx * 0.6) }}
        >
          {letter}
        </span>
      </div>
    );
  }

  const { base, text } = BUTTON_COLORS[letter];
  const light = shade(base, 0.4);
  const dark = shade(base, -0.35);

  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: sizePx,
        height: sizePx,
        background: `radial-gradient(circle at 50% 24%, ${light} 0%, ${base} 55%, ${dark} 100%)`,
        boxShadow:
          "rgb(0 0 0) 0px 1px 5px, rgb(0 0 0 / 0%) 0px -4px 5px inset, rgba(255, 255, 255, 0.3) 0px 2px 3px inset",
      }}
    >
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          top: "9%",
          left: "50%",
          width: "58%",
          height: "34%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.9) 0%, rgba(255,255,255,.35) 40%, rgba(255,255,255,0) 72%)",
        }}
      />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          bottom: "9%",
          left: "50%",
          width: "46%",
          height: "14%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.4) 0%, rgba(255,255,255,0) 80%)",
        }}
      />
      <span
        className="relative flex h-full w-full items-center justify-center font-bold"
        style={{
          color: text,
          fontSize: fontSizePx ?? Math.round(sizePx * 0.6),
          textShadow: "0 1px 0 rgba(255,255,255,.35)",
        }}
      >
        {letter}
      </span>
    </div>
  );
}
