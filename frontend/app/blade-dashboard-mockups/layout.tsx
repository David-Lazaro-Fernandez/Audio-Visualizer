import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";

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
    <div
      className={`${convection.variable} ${ibmPlexMono.variable} font-[family-name:var(--font-convection)]`}
    >
      {children}
    </div>
  );
}
