import { ButtonGlyph } from "./ButtonGlyph";

export interface LegendButton {
  label: string;
  letter: "A" | "B" | "X" | "Y";
  sizePx?: number;
  disabled?: boolean;
  fontSizePx?: number;
}

/**
 * DESIGN.md §6.5 Button legend bar: a persistent 4-slot grammar — left side
 * is contextual (Y/X), right side is navigation (B/A). "Slots never
 * disappear — they dim," so ghosted entries stay in place via `disabled`.
 */
export function ButtonLegendBar({
  left,
  right,
  className,
}: {
  left: LegendButton[];
  right: LegendButton[];
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <div className="flex flex-col gap-1">
        {left.map((entry) => (
          <LegendRow key={entry.label} {...entry} />
        ))}
      </div>
      <div className="flex flex-col items-end gap-1">
        {right.map((entry) => (
          <LegendRow key={entry.label} {...entry} reverse />
        ))}
      </div>
    </div>
  );
}

function LegendRow({
  label,
  letter,
  sizePx,
  disabled = false,
  fontSizePx = 19,
  reverse = false,
}: LegendButton & { reverse?: boolean }) {
  const glyph = <ButtonGlyph letter={letter} sizePx={sizePx} disabled={disabled} />;
  const text = disabled ? null : (
    <span style={{ fontSize: fontSizePx }} className="text-[#f2f7ec]">
      {label}
    </span>
  );

  return (
    <div className="flex items-center gap-[9px]">
      {reverse ? (
        <>
          {text}
          {glyph}
        </>
      ) : (
        <>
          {glyph}
          {text}
        </>
      )}
    </div>
  );
}
