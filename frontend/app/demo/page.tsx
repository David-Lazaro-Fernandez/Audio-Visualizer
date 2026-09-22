import type { Metadata } from "next";
import { WaterDemo } from "./_components/WaterDemo";

export const metadata: Metadata = {
  title: "Water drop ripples",
  description:
    "A GPU-simulated water surface: drops fall, punch a crater, throw a jet, and send concentric ripple packets outward.",
};

/**
 * `/demo`: the water-drop ripple surface.
 *
 * A server component that holds one client island. The work uses browser
 * APIs only (WebGL2, pointer events, requestAnimationFrame). Thus the
 * page only names the route and holds the metadata.
 */
export default function DemoPage() {
  return <WaterDemo />;
}
