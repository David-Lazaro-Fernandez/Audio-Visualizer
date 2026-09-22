/**
 * The media slot of DESIGN.md §6.7: a large rounded rectangle for
 * dynamic content. When it is empty it is glossy and blank and carries a
 * watermark label. Its size comes from an aspect ratio and `w-full` and
 * not from a fixed pixel height. Thus it scales with its column and does
 * not overflow on a narrow viewport.
 */
export function MediaSlot({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex w-full items-center justify-center rounded-[10px] ${className ?? ""}`}
      style={{
        background:
          "repeating-linear-gradient(135deg, rgba(255,255,255,.30) 0 8px, rgba(255,255,255,.14) 8px 16px)",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,.65),inset 0 12px 24px rgba(255,255,255,.25)",
      }}
    >
      <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-(--blade-watermark) sm:text-sm">
        {label}
      </span>
    </div>
  );
}
