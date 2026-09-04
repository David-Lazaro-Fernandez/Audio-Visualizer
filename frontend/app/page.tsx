"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
          Audio Visualizer
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Backend status:{" "}
          <span className="font-mono text-black dark:text-zinc-50">
            {status}
          </span>
        </p>
      </main>
    </div>
  );
}
