import type { Metadata } from "next";
import { WaterDemo } from "./_components/WaterDemo";

export const metadata: Metadata = {
  title: "Water drop ripples",
  description:
    "A GPU-simulated water surface: drops fall, punch a crater, throw a jet, and send concentric ripple packets outward.",
};

/**
 * `/demo` - the water-drop ripple surface.
 *
 * A server component holding one client island. Everything interesting is
 * a browser API (WebGL2, pointer events, requestAnimationFrame), so the
 * page itself only exists to name the route and own the metadata.
 */
export default function DemoPage() {
  return <WaterDemo />;
}
