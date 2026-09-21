import { readdirSync } from "node:fs";
import path from "node:path";
import { GamerPicPicker } from "./GamerPicPicker";
import { LetterBadge } from "./LetterBadge";
import type { GamerProfile } from "./profile";
import { RepStars } from "./RepStars";

/**
 * One label/value row on the profile card. Values are usually numbers
 * (set in bold, DESIGN.md §4); a node (the Rep stars) or a word ("Pro")
 * stays regular weight.
 */
export interface ProfileStat {
  label: React.ReactNode;
  value: React.ReactNode;
}

const GAMERSCORE_LABEL = (
  <>
    <LetterBadge>G</LetterBadge>amerscore
  </>
);

/** The Games blade's rows (DESIGN.md §6.3): Games, Gamerscore, Achievements. */
export function gamerStats(profile: GamerProfile): ProfileStat[] {
  return [
    { label: "Games", value: profile.games },
    { label: GAMERSCORE_LABEL, value: profile.score },
    { label: "Achievements", value: profile.achievements },
  ];
}

/** The Xbox LIVE blade's rows (DESIGN.md §6.3): Rep, Gamerscore, Zone. */
export function liveStats(profile: GamerProfile): ProfileStat[] {
  return [
    { label: "Rep", value: <RepStars filled={profile.rep} /> },
    { label: GAMERSCORE_LABEL, value: profile.score },
    { label: "Zone", value: profile.zone },
  ];
}

/**
 * DESIGN.md §6.3 Gamer profile card: "appears identically wherever
 * identity matters" — gamertag header, gamerpic, then three stat rows, all
 * drawn from the one shared `GamerProfile` (`profile.ts`): the name, the
 * default picture and the online silhouette in the header come from the
 * profile itself, so every card shows the same person. Only the rows
 * differ per blade: Games / Gamerscore / Achievements (`gamerStats`) or
 * Rep / Gamerscore / Zone (`liveStats`). The signed-out counterpart is a
 * separate, simpler card (a "Sign In — N Profiles Found" slot), not a
 * state of this one.
 */
export function GamerProfileCard({
  profile,
  stats,
}: {
  profile: GamerProfile;
  stats: ProfileStat[];
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
        // Transparent card: the blade's section color shows through. The
        // radial gradient is the soft "shine" in the middle of the panel.
        background:
          "radial-gradient(70% 60% at 50% 61%, rgba(255, 255, 255, 0.60), rgba(255, 255, 255, 0) 100%)",
        boxShadow: "rgba(255, 255, 255, 0.35) 0px 15px 14px inset",
        border: "1px solid rgb(192 192 192)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-3 py-1.5 text-[20px] text-[#1a1a1a]"
        style={{
          background:
            "linear-gradient(90deg, rgba(156,156,156,.9) 0%, rgba(156,156,156,0) 100%)",
        }}
      >
        <span className="min-w-0 truncate">{profile.gamertag}</span>
        {profile.online && <LiveSilhouette />}
      </div>
      <div className="flex gap-3.5 p-3">
        <GamerPicPicker
          options={gamerpicOptions}
          defaultSrc={profile.gamerpic}
          gamertag={profile.gamertag}
          stats={stats}
        />
        <div className="grid flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-[3px] text-[19px] text-[#1a1a1a]">
          {stats.map(({ label, value }, index) => (
            <StatRow key={index} label={label} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: ProfileStat) {
  return (
    <>
      <span className="flex items-center">{label}</span>
      <span
        className={`flex items-center justify-end ${typeof value === "number" ? "font-semibold" : ""}`}
      >
        {value}
      </span>
    </>
  );
}

/**
 * The little "gamer" silhouette the 360 draws beside an online profile's
 * gamertag: a head over a shoulders line, drawn as an outline glyph in the
 * header's dark ink.
 */
function LiveSilhouette() {
  return (
    <svg
      aria-label="Xbox LIVE profile"
      role="img"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className="shrink-0"
      fill="none"
      stroke="#3a3a3a"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="7" r="3.6" />
      <path d="M5 20.5c.6-4.2 3.4-6.5 7-6.5s6.4 2.3 7 6.5" />
    </svg>
  );
}
