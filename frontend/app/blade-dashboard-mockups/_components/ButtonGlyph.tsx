const BUTTON_COLORS: Record<"A" | "B" | "X" | "Y", { base: string; text: string }> = {
  X: { base: "#1E5C86", text: "#1a1a1a" },
  A: { base: "#43B039", text: "#1a1a1a" },
  B: { base: "#B91625", text: "#1a1a1a" },
  Y: { base: "#CBD527", text: "#1a1a1a" },
};

/** Mixes `hex` toward white (amount > 0) or black (amount < 0) by `amount` (0-1). */
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
 * DESIGN.md §2.3/§6.5: controller button legends always use the physical
 * button colors (A green, B red, X blue, Y yellow). Rendered as a glossy
 * sphere — radial-gradient base + two blurred highlight ellipses (a strong
 * one near the top, a thin one near the bottom) — to read as a real button
 * cap rather than a flat swatch. `disabled` swaps this out entirely for a
 * flat #E2E2E2-at-70%-opacity disc with a solid #9B9B9B ring and a
 * darker-gray letter, since a disabled slot isn't a pressable colored
 * button anymore but still identifies which button it is.
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
          "0 3px 6px rgba(0,0,0,.5),inset 0 -4px 5px rgba(0,0,0,.4),inset 0 2px 3px rgba(255,255,255,.3)",
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
