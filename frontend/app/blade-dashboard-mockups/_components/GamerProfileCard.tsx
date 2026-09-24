import { readdirSync } from "node:fs";
import path from "node:path";
import { ActiveGamertag } from "./ActiveGamertag";
import { GamerPicPicker } from "./GamerPicPicker";
import { LetterBadge } from "./LetterBadge";
import type { GamerProfile } from "./profile";
import { RepStars } from "./RepStars";

/**
 * One row of a label and a value on the profile card. A value is usually
 * a number, in bold (DESIGN.md §4). A node, such as the Rep stars, or a
 * word, such as "Pro", stays at the regular weight.
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

/** The rows of the Games blade (DESIGN.md §6.3): Games, Gamerscore and Achievements. */
export function gamerStats(profile: GamerProfile): ProfileStat[] {
  return [
    { label: "Games", value: profile.games },
    { label: GAMERSCORE_LABEL, value: profile.score },
    { label: "Achievements", value: profile.achievements },
  ];
}

/** The rows of the Xbox LIVE blade (DESIGN.md §6.3): Rep, Gamerscore and Zone. */
export function liveStats(profile: GamerProfile): ProfileStat[] {
  return [
    { label: "Rep", value: <RepStars filled={profile.rep} /> },
    { label: GAMERSCORE_LABEL, value: profile.score },
    { label: "Zone", value: profile.zone },
  ];
}

/**
 * The gamer profile card of DESIGN.md §6.3. It looks the same at each
 * position where the identity is necessary: a gamertag header, the gamer
 * picture and then three stat rows. All of it comes from the one shared
 * `GamerProfile` (`profile.ts`). The online silhouette in the header and
 * the stat rows come straight from the `profile` prop, since those never
 * change with a sign-in (`profile.ts` explains why); the name and the
 * default picture instead go through `ActiveGamertag` and
 * `GamerPicPicker`, the two client leaves that read
 * `SignedInProfileContext` so every card updates together when the user
 * signs in as a different `SIGN_IN_PROFILES` row (§6.22). Only the stat
 * rows differ by blade: Games, Gamerscore and Achievements
 * (`gamerStats`), or Rep, Gamerscore and Zone (`liveStats`). The
 * signed-out card is a separate and more simple card, a "Sign In - N
 * Profiles Found" slot, and not a state of this card.
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
        // The card is transparent, thus the section colour of the blade
        // shows through. The radial gradient is the soft shine at the
        // middle of the panel.
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
        <ActiveGamertag className="min-w-0 truncate" />
        {profile.online && <LiveSilhouette />}
      </div>
      <div className="flex gap-3.5 p-3">
        <GamerPicPicker options={gamerpicOptions} stats={stats} />
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
 * The small gamer silhouette that the console draws beside the gamertag
 * of an online profile: a head above a line of shoulders, as an outline
 * glyph in the dark ink of the header.
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
