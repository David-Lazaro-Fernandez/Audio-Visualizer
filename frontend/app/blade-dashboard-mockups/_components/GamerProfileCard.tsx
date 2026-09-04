import { readdirSync } from "node:fs";
import path from "node:path";
import { GamerPicPicker } from "./GamerPicPicker";
import { LetterBadge } from "./LetterBadge";

/**
 * DESIGN.md §6.3 Gamer profile card: "appears identically wherever
 * identity matters" — gamertag header, gamerpic, Games, Gamerscore, and
 * Achievements counts. The signed-out counterpart is a separate, simpler
 * card (a "Sign In — N Profiles Found" slot), not a state of this one.
 */
export function GamerProfileCard({
  gamertag,
  games,
  score,
  achievements,
}: {
  gamertag: string;
  games: number;
  score: number;
  achievements: number;
}) {
  const gamerpicOptions = readdirSync(
    path.join(process.cwd(), "public", "profile_pics"),
  )
    .filter((file) => file.endsWith(".png"))
    .sort()
    .map((file) => `/profile_pics/${file}`);

  return (
    <div
      className="w-full overflow-hidden rounded-[12px]"
      style={{
        // Transparent card: the blade's green shows through. The radial
        // gradient is the soft "shine" in the middle of the panel.
        background:
          "radial-gradient(70% 60% at 50% 61%, rgba(255, 255, 255, 0.60), rgba(255, 255, 255, 0) 100%)",
        boxShadow: "rgba(255, 255, 255, 0.35) 0px 15px 14px inset",
        border: "1px solid rgb(192 192 192)",
      }}
    >
      <div
        className="truncate px-3 py-1.5 text-[20px] text-[#1a1a1a]"
        style={{
          background:
            "linear-gradient(90deg, rgba(156,156,156,.9) 0%, rgba(156,156,156,0) 100%)",
        }}
      >
        {gamertag}
      </div>
      <div className="flex gap-3.5 p-3">
        <GamerPicPicker
          options={gamerpicOptions}
          gamertag={gamertag}
          games={games}
          score={score}
          achievements={achievements}
        />
        <div className="grid flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-[3px] text-[19px] text-[#1a1a1a]">
          <span>Games</span>
          <span className="font-semibold">{games}</span>
          <div style={{ display: "flex", justifyContent: "start", alignItems: "center" }}>
            <LetterBadge>G</LetterBadge>amerscore
          </div>
          <span className="font-semibold">{score}</span>
          <span>Achievements</span>
          <span className="font-semibold">{achievements}</span>
        </div>
      </div>
    </div>
  );
}
