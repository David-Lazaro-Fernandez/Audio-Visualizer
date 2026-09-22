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
    // The games theme is the default of the full section (DESIGN.md
    // §2.2), and also of the portal root below. Thus a full-screen
    // surface stays green at each open blade. BladeCanvas replaces the
    // theme for each blade.
    <div
      className={`${convection.variable} ${ibmPlexMono.variable} font-[family-name:var(--font-convection)]`}
      style={themeVars(GAMES_THEME)}
    >
      {children}
      {/* The portal target of each full-screen surface. It is inside
          this element, thus a surface takes the blade fonts. Refer to
          _components/portal.ts. */}
      <div id={PORTAL_ROOT_ID} />
    </div>
  );
}
