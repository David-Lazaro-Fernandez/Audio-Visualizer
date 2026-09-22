import type { Metadata } from "next";
import { ParticlesPage } from "./_components/ParticlesPage";

export const metadata: Metadata = {
  title: "Particles",
  description:
    "Any Apple Music song's preview, transformed offline and drawn as a cloud of particles: time, frequency and level on three axes.",
};

/**
 * `/particles`. A server component holding one client island — every
 * interesting part is a browser API (Web Audio, WebGL, fetch), so the
 * page itself only names the route and owns the metadata.
 */
export default function Page() {
  return <ParticlesPage />;
}
