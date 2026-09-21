import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { PORTAL_ROOT_ID } from "./_components/portal";
import { GAMES_THEME, themeVars } from "./_components/blade-theme";

const convection = localFont({
  src: "../../public/assets/fonts/Convection.ttf",
  variable: "--font-convection",
  weight: "400",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nova OS — blade dashboard mockups",
};

export default function BladeDashboardMockupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The games theme is the default for the whole section (DESIGN.md §2.2),
    // including the portal root below, so full-screen surfaces stay green
    // whichever blade is open; BladeCanvas overrides it per blade.
    <div
      className={`${convection.variable} ${ibmPlexMono.variable} font-[family-name:var(--font-convection)]`}
      style={themeVars(GAMES_THEME)}
    >
      {children}
      {/* Portal target for full-screen surfaces, kept inside this element
          so they inherit the blade fonts — see _components/portal.ts. */}
      <div id={PORTAL_ROOT_ID} />
    </div>
  );
}
