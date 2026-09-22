/**
 * Replaces one letter with a circular badge glyph, such as the "G" of
 * "Gamerscore". The size is in `em`, thus the badge scales with the text
 * around it. It is a <span> and stays inline:
 * `<LetterBadge>G</LetterBadge>amerscore`.
 */
export function LetterBadge({ children }: { children: string }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full align-[-0.15em] font-bold"
      style={{
        boxSizing: "content-box",
        width: "1em",
        height: "1em",
        padding: "3px",
        marginRight: "2px",
        fontSize: "0.82em",
        background: "radial-gradient(circle at 35% 30%, #4a4a4a, #0f0f0f 75%)",
        color: "#d9d9d9",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.25),0 1px 1px rgba(0,0,0,.4)",
      }}
    >
      {children}
    </span>
  );
}
