import type { Metadata } from "next";
import { ParticlesPage } from "./_components/ParticlesPage";

export const metadata: Metadata = {
  title: "Particles",
  description:
    "Any Apple Music song's preview, transformed offline and drawn as a cloud of particles: time, frequency and level on three axes.",
};

/**
 * `/particles`. A server component that holds one client island. The
 * work uses browser APIs only (Web Audio, WebGL, fetch). Thus the page
 * only names the route and holds the metadata.
 */
export default function Page() {
  return <ParticlesPage />;
}
