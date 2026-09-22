import { ButtonGlyph } from "./ButtonGlyph";

export interface LegendButton {
  label: string;
  letter: "A" | "B" | "X" | "Y";
  sizePx?: number;
  disabled?: boolean;
  fontSizePx?: number;
}

/**
 * The button legend bar of DESIGN.md §6.5: a grammar of four slots that
 * is always present. The left side is contextual, with Y and X. The
 * right side is navigation, with B and A. A slot never disappears: it
 * dims. Thus an inactive entry stays in position and uses `disabled`.
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
