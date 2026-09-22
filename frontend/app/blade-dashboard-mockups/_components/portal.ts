/**
 * The target of each full-screen surface, such as the Games Library, the
 * gamer picture picker and a detail box. The blade layout declares its
 * fonts, Convection and IBM Plex Mono, as CSS variables on its own
 * wrapper element. Thus a portal directly to <body> would use the root
 * font. The layout renders an empty `#blade-portal-root` in that
 * wrapper as the target. <body> is only the fallback when that element
 * is absent.
 */
export const PORTAL_ROOT_ID = "blade-portal-root";

export function getPortalRoot(): HTMLElement {
  return document.getElementById(PORTAL_ROOT_ID) ?? document.body;
}
