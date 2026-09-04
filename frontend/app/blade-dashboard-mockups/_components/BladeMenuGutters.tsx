import { PANEL_LEFT_PCT, PANEL_RIGHT_INSET_PCT } from "./blade-layout";

const GUTTER_FILL = "linear-gradient(180deg,#c9c9c9,#ececec 45%,#c4c4c4)";

/**
 * The collapsed tab stack sits on a neutral gray field, not the active
 * section's color (DESIGN.md §2.3: "only the active section's color is
 * saturated"). This sits behind BladeEdges, absolutely positioned like it,
 * and stops exactly at the panel's edges so it only reaches the menu
 * (tab) area — never the active content in the center.
 */
export function BladeMenuGutters() {
  return (
    <>
      <div
        className="absolute inset-y-0 left-0 opacity-95"
        style={{ width: `${PANEL_LEFT_PCT}%`, background: GUTTER_FILL }}
      />
      <div
        className="absolute inset-y-0 right-0 opacity-95"
        style={{ width: `${PANEL_RIGHT_INSET_PCT}%`, background: GUTTER_FILL }}
      />
    </>
  );
}
