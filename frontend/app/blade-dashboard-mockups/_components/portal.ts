/**
 * Where full-screen surfaces (Games Library, gamerpic picker, detail boxes)
 * portal to. The blade layout defines its fonts (Convection, IBM Plex Mono)
 * as CSS variables on its own wrapper element, so anything portaled
 * straight to <body> would fall back to the root font. The layout renders
 * an empty `#blade-portal-root` inside that wrapper for portals to target;
 * <body> is only a fallback if it's ever missing.
 */
export const PORTAL_ROOT_ID = "blade-portal-root";

export function getPortalRoot(): HTMLElement {
  return document.getElementById(PORTAL_ROOT_ID) ?? document.body;
}
