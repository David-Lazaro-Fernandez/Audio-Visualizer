"use client";

import { useEffect, useState } from "react";

/**
 * A live HH:MM AM/PM clock, updated every 30 s: the console's own header
 * clock, shown on the Change Gamer Picture screen (DESIGN.md §6.3) and
 * the Sign In drawer (§6.22).
 */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<string>(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{now}</span>;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
