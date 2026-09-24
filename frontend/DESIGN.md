# Nova OS blade dashboard — design guide

Design source of truth for `app/blade-dashboard-mockups/`. The components cite
sections of this file by number (e.g. "DESIGN.md §6.2") in their JSDoc, so keep
the numbering stable when editing. Where a rule has a canonical constant in
code, the file is named so the two stay in sync.

The dashboard is a recreation of the Xbox 360 "blade" dashboard for a fictional
console OS, "Nova OS". It is a **10-foot UI**: designed to be read from a couch,
so everything is large, high-contrast, and driven by a D-pad cursor rather than
a mouse pointer.

---

## 1. Blade anatomy

The entire top-level UI is a stack of **blades**. One blade is open and expands
to fill the center of the screen; the rest collapse into narrow, curved vertical
tabs fanned to either side, labelled with rotated text. The collapsed tabs *are*
the top-level navigation.

Blade order, left to right: **store · community · games · media · system**.
Games is the default open blade. Left/Right (or clicking a tab) moves through
this order. Panel titles follow the console: Marketplace, Xbox LIVE, Games,
Media, System. Each blade is declared once as a `BladeSection` (label, title,
section colors) and its content once as a `BladePanel`; only the open blade's
panel renders. All five blades are built.

The active blade's panel is laid out as:

- **Header band** at the top with the section title (§5.2).
- **Left column**: gamer profile card (§6.3), then the section menu (§6.2), then
  the wide "Open Tray" pill anchored near the bottom (§6.6).
- **Right column**: section artwork or logo above, and the description pane
  (§6.4) beside the menu, aligned to the same rows in a 2×2 grid.
- **Legend band** at the bottom with the controller button legend (§6.5).

### 1.1 Blade curve geometry

Every edge, whether a collapsed tab or the active panel, is generated from
**one** curve, the "lazy S", shifted to a different top-x. See
`_components/blade-curve.ts`.

Reading top to bottom, an edge:

1. runs straight off the top edge of the screen,
2. holds a near-vertical shoulder,
3. bows about 2% inward at the waist,
4. then flares outward and exits the bottom edge.

The reference curve is defined on a 1280×720 frame by seven y-stops
(0, 130, 250, 380, 510, 625, 720) with x-deltas (0, −13, −19, −13, −7, +30,
+85), scaled to 90% of that bow/flare radius. Two cubic beziers are sampled at
16 steps each so the shape is as smooth as an SVG path.

Rules:

- The active panel is **never a rectangle**. Its left edge follows the
  left-stack curve family and its right edge the right-stack family.
- Left-stack tabs are **mirrored** (bow right, flare left); right-stack tabs are
  not (bow left, flare right). The stack reads as a fanned hand of cards.
- Each edge carries a thin silver rim. Gaps between tabs widen downward.
- Tab labels rotate 90° clockwise (`writing-mode: vertical-rl`) on both sides.
- Shapes are plain `<div>`s clipped with `clip-path: polygon(...)`, **not**
  `<svg>`/`<path>`. The clip-path is what makes a tab's clickable area its
  actual curved shape.

### 1.2 Reference frame

All chrome is positioned as a **percentage of the 1280×720 reference frame**,
never as one-off pixel values. `_components/blade-layout.ts` exposes `pctX`,
`pctY` and the shared constants:

| Constant | Reference px | Meaning |
| --- | --- | --- |
| `LEFT_STACK_X` | x = 152 | Left edge of the first tab |
| `TAB_WIDTH` / `TAB_PITCH` | 44 / 48 | Tab width and the 4 px gap rhythm |
| `PANEL_WIDTH` | 708 | Width of the active panel, on every blade |
| `PANEL_LEFT_PCT` | x = 292 | Left edge of the panel with games open |
| `PANEL_RIGHT_INSET_PCT` | x = 1000 | Right edge of the panel with games open |
| `CONTENT_TOP_PCT` | y = 26 | Top of the title / content band |

**The panel slides with the open blade.** Tabs up to and including the
open one fan to the left of the panel (mirrored curve); the rest fan to the
right. So with games open the left stack is at 152, 200, 248 and the right
stack at 1000, 1048; with Xbox LIVE open the panel spans 244–952 and three
tabs stack on the right. `panelGeometry(activeIndex)` returns the edges,
gutter widths and clip-path for any blade, and `tabTopX` / `tabMirrored`
place each tab. The chrome components read this from `BladeNavContext`.

---

## 2. Color

### 2.1 Section colors

Each section owns one signature **radial gradient** background, centered at
50% / 44% of the panel. The gradient is the section's identity; it is applied to
the canvas, the active panel, the active tab, and any full-screen surface that
belongs to the section.

Games:

```
radial-gradient(90% 80% at 50% 44%, #6ecb2e 0%, #52b81f 30%, #3e9c16 62%, #2f7e10 100%)
```

Active tab fill: `linear-gradient(90deg, #478f14, #95e04d 35%, #57a91b)`.

Xbox LIVE (community), gold:

```
radial-gradient(90% 80% at 50% 44%, #f8cd5e 0%, #f3ae3c 30%, #e4952b 62%, #cf7b1d 100%)
```

Active tab fill: `linear-gradient(90deg, #c67a1a, #f8c85e 35%, #e39a2b)`.

Media, sky blue:

```
radial-gradient(90% 80% at 50% 44%, #6dbdf4 0%, #46a2e8 30%, #2f86d2 62%, #2369b4 100%)
```

Active tab fill: `linear-gradient(90deg, #2472b8, #86ccf6 35%, #3f97da)`.

Each gradient is declared once as **data**, not as a CSS string
(`_components/blade-gradient.ts`): a focal point, two radii and four color
stops. `gradientCss()` derives the CSS from it and the surface shader
reads the same numbers, so the two painters cannot drift. Every section
deliberately shares the same four stop positions — that is what makes a
blade switch a per-stop interpolation (§7.4) rather than a crossfade.

System, purple, with `#804EA9` as the blade colour at the 30% stop:

```
radial-gradient(90% 80% at 50% 44%, #9c6fc6 0%, #804ea9 30%, #6d4094 62%, #58327b 100%)
```

Active tab fill: `linear-gradient(90deg, #613889, #b58ad9 35%, #8a58b6)`.

Marketplace (store), orange around a pale peach core:

```
radial-gradient(90% 80% at 50% 44%, #f7c9a0 0%, #eea673 30%, #e0834a 62%, #c9652b 100%)
```

Active tab fill: `linear-gradient(90deg, #b8500f, #ff9d4e 35%, #e06a1a)`.

The
Nova mockups also define steel (system task blade) and gold (decision
dialog) surfaces for overlays; use the same radial structure when adding them.

### 2.2 Text on section color

Text, rules and small glyphs on a blade are tints of its own section color.
Each `BladeSection` carries them as a `BladeTheme` (`blade-theme.ts`), which
`BladeCanvas` sets as CSS variables; the shared components read the
variables rather than literal greens. The section layout sets the games
values as the default, so full-screen surfaces (which portal outside the
canvas) stay green unless they set another theme on their root, as the
Music Library screen does with `MEDIA_THEME`.

| Role | Variable | Green (games) | Gold (Xbox LIVE) | Blue (media) | Purple (system) | Orange (store) |
| --- | --- | --- | --- | --- | --- | --- |
| Primary text | `--blade-ink` | `#17300a` | `#2a1a04` | `#0a2240` | `#1f0f33` | `#2e1a0c` |
| Secondary / meta text | `--blade-ink-soft` | `#1f3b0d` | `#3d2707` | `#123056` | `#2d1a45` | `#40250f` |
| Row divider lines (3 px) | `--blade-rule` | `#379226` | `#f2c66a` | `#7cc4f2` | `#a17dc6` | `#c97a45` |
| List top/bottom rule (2 px) | `--blade-rule-strong` | `#43AB33` | `#f7d585` | `#a3d7f7` | `#b797d6` | `#d48a56` |
| Eject glyph, rest / cursor | `--blade-glyph` / `--blade-glyph-hover` | `#3e941d` / `#1f5c0c` | `#a86a12` / `#5e3a06` | `#2a74b8` / `#143f6e` | `#5c3480` / `#331b4d` | `#a8581c` / `#5e2e0a` |
| Placeholder watermark | `--blade-watermark` | `#2b4a12` | `#5a3a0a` | `#123a60` | `#3a2154` | `#6a3812` |

Rules are darker than the panel on Games and Marketplace and lighter on
Xbox LIVE, Media and System, following the console: the dividers read as
shadow lines on green and peach and as pale lines on gold, blue and
purple.

Fixed regardless of section:

| Role | Color |
| --- | --- |
| Panel and screen titles | white, `text-shadow: 0 1px 2px rgba(0,0,0,.28)` |
| Legend labels | `#f2f7ec` |
| Text on neutral / white surfaces | `#151515` body, `#3a3a3a` secondary, `#5a5a5a` muted |
| Disabled text on green (§7.2) | `#8fd36a` |

### 2.3 Neutrals and saturation

**Only the active section's color is saturated.** Everything that is not the
open blade sits on neutral silver or gray:

- Collapsed tab fill: `linear-gradient(90deg, #a9a9a9, #fbfbfb 30%, #dcdcdc 62%, #b6b6b6)`; label `#7d7d7d`, white on hover.
- Tab gutters behind the collapsed stacks: `linear-gradient(180deg, #c9c9c9, #ececec 45%, #c4c4c4)` at 95% opacity. Gutters stop exactly at the panel edges.
- Detail boxes and cards on neutral: `linear-gradient(180deg, #ffffff, #f2f2f2 52%, #dcdcdc)`.
- Branded tiles: flat `#616063`.

Controller button legends always use the **physical button colors**, never a
themed color:

| Button | Base |
| --- | --- |
| A | `#43B039` green |
| B | `#FA3A2F` red |
| X | `#1E5C86` blue |
| Y | `#CBD527` yellow |

Letters on live buttons are `#1a1a1a`.

---

## 3. Materiality

Surfaces are glossy and physical, never flat. The first three rules
below describe the blade surface as CSS paints it; where WebGL2 is
available a water sheet supersedes all three (§3.1).

- **Concentric sheen.** The panel background carries alternating light and
  dark radial rings fading toward the edges, all centered on the 50% / 44%
  focal point. See `_components/BladeBackground.tsx` for the exact stops.
- **Ripples.** Two ring outlines (2 px, white at 30% and 22%) scale from 0.35×
  to 1.6× over 9 s on an ease-out loop, offset by half a period, so waves
  appear to propagate from the center. Full-screen surfaces render the same
  background unclipped.
- **Specular gloss.** The active panel has a top-down white gradient (30% →
  5% at 45% → 0%) and a 2.5 px inset rim in `rgba(240,240,240,.7)`.
- **Bevels.** Raised elements use inset shadows and 1 px light rims rather
  than borders alone. Bevel shadows go on the top, left and right edges only;
  the bottom edge stays clean.
- **Glossy spheres.** Controller glyphs are a radial-gradient sphere (light at
  the top, dark at the bottom) with two blurred highlight ellipses.
- **Translucent cards.** Cards on the blade let the section color show through
  (white radial "shine" over transparency) rather than painting an opaque fill.
- **Placeholder texture.** Empty slots use a 135° repeating stripe with a
  monospace watermark label.

### 3.1 How the surface is painted

The section gradient and the blade's materiality are one **WebGL2 canvas**
(`_components/blade-water-gl.ts`, driven by `BladeSurface.tsx`), drawn in
two passes:

1. A screen-space quad painting the §2.1 radial gradient. The blade's
   identity is still a gradient, not a rendering of water. Because the
   stops arrive as numbers (`blade-gradient.ts`) a blade switch is a real
   per-stop interpolation (§7.4), and the gradient is dithered, which
   kills the banding the CSS version shows across a wide panel. Those
   same numbers are what let the Music Player's bass envelope *move* the
   gradient rather than paint something over it (§6.16).
2. A **water sheet** over it, banked about the world Z axis (45° to start
   with), which supersedes the concentric sheen, the two ripple rings and
   the specular gloss. Drops land on a timer; each one punches a crater, throws a jet
   and sends a slow swell outward. The wave field is shared with the
   `/demo` page (`app/_water/water-field.ts`): a Gaussian-enveloped
   radial wave packet plus a center jet, superposed, with its radial
   derivative carried alongside the height so every fragment gets an
   exact analytic normal.

The water contributes **only relief**: the reflected sky on a crest, the
deep tint in a trough, and nothing at all where the surface is still. So
an undisturbed blade looks exactly like the gradient it has always been,
and the swell is something that happens on top of it. Its palette is
derived from the section's own gradient (`waterPalette`), so the water is
green on Games, gold on Xbox LIVE and blue on Media without a second
table of colors to maintain. The tuned wave constants live in
`blade-water.ts`.

**Nothing draws the drop itself.** A dashboard wants the swell, not the
splash, so the crater and the jet are zeroed here — they are a
0.25-unit-wide spike that saturates the relief into a hard pin-prick at
every impact — and `uQuiet` suppresses each drop within a radius of its
origin. Since the wavefront advances as `r = c·t`, a gate in radius is
also a fade-in in time: a drop swells into view over its first second
instead of appearing. `/demo` keeps the crater and jet, because there
they are the subject.

Every one of those constants, the bank included, is live-adjustable from
a development overlay (`BladeWaterControls`, fed by
`blade-water-controls.ts`). It is **off by default** and is not part of
the dashboard: the 10-foot UI has no controls (§8), so the panel is
something to switch on with `SHOW_WATER_CONTROLS` while tuning and
switch off again. It writes straight into the uniforms, so nothing it
touches remounts a canvas or recompiles a shader, and because it is a
module-level store rather than context, one slider drives the blade
canvas and every full-screen surface stacked over it at once. Its
sliders are safe beside the global D-pad because `KeyboardNav` ignores
any event targeting an `<input>`.

The shader has no `clip-path`, so it masks the water to the panel itself
— the swell belongs to the open blade and must not spill onto the
collapsed tab gutters. Because every edge in §1.1 is the same curve
shifted to a different top-x, one sampled profile `d(y)` is enough: the
panel runs from `leftX − d(y)` to `rightX + d(y)` (`edgeDeltaTable` in
`blade-curve.ts`). Two scalars, so the mask glides with the CSS
clip-path on a blade switch instead of needing its own 66 vertices. The
gradient pass is never masked; it is the full canvas.

Everything works in **sRGB**, with no tone mapping and no color-space
conversion, because this surface has to match the CSS gradient it falls
back to pixel for pixel and CSS composites in sRGB.

**The shader is an upgrade, never a dependency.** Every surface keeps its
CSS `background` underneath, and the CSS sheen and rings stay in
`BladeBackground`. The canvas publishes `painted` only after it has
actually drawn a frame; until then — before hydration, on a browser
without WebGL2, after a lost context — the CSS layers paint exactly as
they did, and the handover never flashes. The layers with a shader twin
(`BladeEdges`' panel fill and gloss, `BladeBackground`) read that flag
and stand down. The 2.5 px panel rim stays in CSS either way, because it
has to follow the clip-path exactly. The fallback is not a like-for-like
picture of the water — CSS cannot draw a banked sheet — but it is the
surface the dashboard was designed around, so an old browser gets a
complete blade rather than a broken one.

---

## 4. Typography

The blade section uses two faces, set as CSS variables on the section layout
(`app/blade-dashboard-mockups/layout.tsx`):

| Variable | Face | Use |
| --- | --- | --- |
| `--font-convection` | Convection (local, `public/assets/fonts/Convection.ttf`) | Everything by default |
| `--font-ibm-plex-mono` | IBM Plex Mono 400 | Watermarks and placeholder labels only |

Sizes are large and literal for the 10-foot context. Prefer these steps:

| Role | Size |
| --- | --- |
| Blade / screen title | `text-3xl`, `text-4xl` from `sm` |
| Description pane title | 30 px |
| Description pane body | 22–26 px, `leading-snug`, `text-pretty` |
| Menu row label | 23 px |
| Menu row meta | 20–22 px |
| Card heading / gamertag | 20 px |
| Card stats | 19 px |
| Legend label | 19 px (21 px for the emphasized Select slot) |
| Tab label | 20 px |
| Detail box title / body | 19 px / 15 px |
| Brand wordmark | 26 px bold, tight tracking |

Titles are regular weight. Bold is reserved for numeric stat values, the
controller letters, and the brand wordmark.

---

## 5. Layout and surfaces

### 5.1 Layers

Inside the canvas, from back to front:

0. The surface shader's `<canvas>` (§3.1): section gradient full-bleed,
   with the water sheet over it, masked to the panel curve
1. Tab gutters (neutral gray fields)
2. Active panel with gradient and gloss
3. Concentric sheen and ripples, clipped to the panel curve
4. Content layer (`z-10`), padded to the panel edges
5. Tab navigation (`z-20`), full-bleed but `pointer-events-none` so only the
   tab shapes themselves hit-test
6. Detail boxes (`z-30`)
7. Full-screen surfaces (`z-40`)

### 5.2 Header and legend bands

The header and legend bands sit on a **darker tint of the section color**, not a
solid fill. Implement as a translucent black overlay (`bg-black/10`) so the
gradient and sheen still show through, dimmed. The corners facing the content
are rounded 25 px; there is no hard border between band and content.

### 5.3 Master–detail

Selecting a menu row opens a **box of content** beside it. Placement is
measured against the menu boundary at runtime (`menu-box-placement.ts`):

1. Try to the right of the row with a 16 px gap.
2. Fall back to below the row.
3. If neither fits (minimum 220 × 96 px), render nothing rather than overflow.

Boxes are capped at 320 px wide, use the neutral gradient (§2.3), a 10 px
radius, and a title row with a `×` close control.

Rows that lead to a **full-screen destination** open that screen instead. The
row that opened it owns the open state and the Back key.

### 5.4 Full-screen surfaces and portals

Full-screen surfaces (Games Library, gamer picture picker) portal to
`#blade-portal-root`, which the section layout renders inside its own font
wrapper so the surfaces inherit Convection. They set `role="dialog"` and
`aria-modal="true"`, which also tells the D-pad handler not to switch blades
underneath them. Focus moves to the first live item on open and returns to the
opener on close.

Full-screen menu surfaces reuse the blade structure: same section gradient and
unclipped sheen, header and legend bands, a left column of raised buttons under
a branded tile, and a borderless description pane on the right with the
highlighted row's title and one or two sentences. Horizontal padding is 12%.

The middle content band is a raised slab stacked above the header and legend
bands (content `z-10`, chrome `z-0`). It carries four shadows on one
container. Two inset: pale grey `#d9d9d9` fading from 30% at the top and
bottom edges to 0% at the centre (Figma reference node 158:5). Two outer:
dark `rgba(0,0,0,.35)` with a 2 px offset and 15 px blur, cast upward onto
the header and downward onto the legend, so the chrome reads as tucked
beneath the content. The set lives in `CONTENT_BAND_SHADOW`
(`BladeChromeBand.tsx`); Games Library and My Games both use it. On My Games
the slab includes the tab strip, so the tabs sit on the lit content rather
than in the seam.

Screens stack: Games blade → Games Library → My Games; the blade's
Achievements row opens the Achievements screen (§6.10) directly. On Media,
the blade's Music row opens the Music screen (§6.11), whose Music Player row
opens the Music Library screen (§6.12), and the Pictures row opens the
Pictures screen (§6.13), whose Computer row opens the picture browser
(§6.13.1), whose tiles and Play Slideshow open the picture viewer
(§6.13.2). Each is
its own portal, so later screens simply paint over earlier ones. Back (ESC / B) is
arbitrated by a module-level stack (`back-stack.ts`): only the topmost open
surface answers, so one press peels off one screen.

The portal root sits outside the canvas, so a surface opened from a blade
other than Games sets its own section theme (§2.2) on its root, as the
Music screen does with the media blue.

**Only the topmost surface paints.** Each screen carries its own water
shader (§3.1), and each one is opaque and full-bleed, so reaching the
Music Player means six WebGL2 contexts drawing a full viewport each and
five of them behind an opaque cover. A second module-level stack
(`surface-stack.ts`) tracks which layer is on top; the ones below stop
asking for frames and hold their last one. They are correct again on the
frame after the cover closes, because the water is a function of the
clock and not of the frames it drew — and they keep `painted` true
throughout, so the CSS twins stay down and the reveal cannot flash. It
is a second stack rather than a field on the back stack because the two
answer different questions: Back is a key and belongs to a screen, while
a cover is any opaque layer, and the Music Player's full-screen
visualization is one without being a screen.

### 5.5 Tab strip

Filter tabs sit directly under the header band as a row of plain text
labels at 26 px with a 40 px gap, no underline or pill. "All Games" leads
and is the default. The active tab is
white with the title's text shadow; inactive tabs are the dark section green
and turn white on hover; unavailable tabs use the disabled green (§7.2). Tabs
are not cursor stops: Left/Right anywhere on the screen step through the
enabled tabs (the console used the bumpers), and clicking works too. Switching
tabs refilters the list and returns the cursor to the first row.

---

## 6. Components

### 6.1 Blade tabs

Each collapsed tab is `<li><button>` inside `<aside><nav><ul>`. The button fills
the tab's bounding box; its visible and clickable shape is the clipped div.
Hover and focus brighten the fill 10% and turn the label white (black on the
active tab). The active tab is marked `aria-current="page"`.

### 6.2 List item (menu row)

A small monochrome icon on the left plus a label, rows separated by thin
divider lines. Rendered as a real `<button>` because rows are navigable menu
items. The list is `<aside><nav><ul>`.

Variants:

- **row** (default): 3 px `#379226` bottom border, 13 px / 11 px padding.
  The cursor (hover and focus) is a horizontal light wash, not a box: pale
  grey `#d9d9d9` fading from transparent at both edges to 50% just left of
  centre (stops 0 → 20% → 30% → 50% and back; Figma reference node
  166:13, peak raised from 40%). No focus ring. The wash sits on a pseudo-element so it can fade
  in over the 150 ms tempo (`ROW_CURSOR_WASH` in `MenuListItem.tsx`). The
  list carries a 2 px `#43AB33` rule at the top and bottom. With `iconOnly`
  the row is just its icon, centred, and the label becomes the button's
  `aria-label` (the Achievements screen's column of title art, §6.10). With
  `chevron` a right-pointing triangle in `--blade-glyph` (a CSS shape, like
  the eject mark) sits at the row's end and fades in with the wash: the
  console's cue that the row has a list to its right (Music Library,
  §6.12). With `subtitle` the label stacks over a second, softer line in
  place of a single line, for a row named by its content type rather
  than by a trailing value (the Spotlight list, §6.20).
- **button**: the raised skin for full-screen menus. Two stacked bands: a
  transparent 26 px top band, and the row band with a left-to-right gradient
  from transparent to white at 39%. Icon and label left, meta right. 1 px
  `#5a5a5a` border, 10 px radius, three one-sided inset bevel shadows. The
  icon is oversized (44 px) and shifted up 10 px so it straddles the band
  split. Cursor state washes the whole button left to right in pale grey
  `#d9d9d9`: transparent at the left edge, 80% at the middle, 90% at three
  quarters, solid at the right (Figma reference node 170:22), fading in on
  a pseudo-element over the 150 ms tempo. It uses plain `focus` (not
  `focus-visible`) so a mouse-clicked row stays lit like the console cursor.
  With `compact` the empty top band is dropped and the row band alone
  carries the skin, at label height with 11 px padding: the entries of a
  browse list (the Music Library's albums, §6.12), where the full button
  is too tall to stack a dozen deep.
- **brand**: dark steel gradient pill with the swirl glyph and the two-tone
  wordmark (`#8bc93e` / `#e2701f`).

Menu icons (`MenuIcons.tsx`) share one finish: translucent white fill
(`rgba(255,255,255,.5)`), 1 px edge in white at 70%, inked details in black
at 32%, soft drop shadow. The section colour shows through, so the same set
suits every blade. They are plain server-rendered SVG. The set is trophy,
controller, joystick and disc for the Games blade, globe (with a small
controller) for "Connect to Xbox LIVE", and music (disc with a note),
pictures (camera) and videos (camcorder) for the Media blade, two fanned
game cards with a controller for the Achievements screen's "All Games"
row, and for the Marketplace blade (§6.19) a down arrow with a star, a
starburst, a film case with a disc, a flat card, a download roundel and
a crown, plus the Marketplace "m" roundel, currently unused. The music menus
have their own: hard drive, monitor and pocket player for the Music
screen's sources (§6.11); microphone, list with a note, single note and
guitar for the Music Library categories (§6.12); and a play roundel, a
list with a plus, a pencil and a bin for the Play / Add to Current
Playlist / Edit Info / Delete actions shared by the album and song
screens (§6.14, §6.15). Icons that are full-colour bitmaps on the
console (Media Center's Windows flag, title art, achievement art) are
not redrawn in this finish: the row takes an `<Image>` node from
`public/assets/` as its `icon` instead, and shows the striped
placeholder (§6.7) until the bitmap is available.

Omitting `icon` leaves the neutral square, which is the placeholder for a
bitmap not yet redrawn. Passing `icon={null}` means the row has **no**
icon at all and closes the gap where one would sit — the console's track
lists and playlists carried none (§6.14, §6.16).

### 6.3 Gamer profile card

Appears identically wherever identity matters. Structure: gamertag header bar,
gamer picture, then three stat rows. There is one signed-in gamer
(`profile.ts`), and every card shows that same person: same gamertag, same
picture (the profile's default until the user picks another, then the
shared pick), and the LIVE silhouette glyph at the header's right whenever
the profile is online. Only the rows differ per blade: on Games they are
Games, Gamerscore and Achievements counts (`gamerStats`); on Xbox LIVE and
Media they are Rep (five stars, `RepStars`, lit in the Y button's yellow),
the same Gamerscore, and Zone (`liveStats`). Numeric values are bold; stars
and words are not. The header is a left-to-right gray fade
(`rgba(156,156,156,.9)` → transparent). The card is translucent with a white
radial shine, a 1 px `rgb(192,192,192)` border, and a 12 px radius. The "G"
in Gamerscore is a dark circular badge glyph sized in `em`. The picture
picker's echo card repeats whichever rows the card shows.

The gamer picture is 76 px square with a 6 px radius. Hovering reveals a pencil
affordance; selecting opens the "Change Gamer Picture" screen: black header
(title, current picture, live clock), light gray picture grid on the left with
the selection framed in `#1e8a1e`, mid-gray pane on the right echoing the card,
black footer with A Select / B Back.

The signed-out state is a separate, simpler card ("Sign In — N Profiles
Found"), not a state of this one.

### 6.4 Description pane

Borderless text beside the menu showing the highlighted row's blurb, updated on
hover or focus via a shared provider. It is `aria-live="polite"`. Full-screen
menus and the Xbox LIVE blade also show a 30 px title above the blurb: the
row's label, or its `descriptionTitle` when the pane should name something
other than the row ("Connect to Xbox LIVE" is described under "Xbox LIVE").

### 6.5 Button legend bar

A persistent **four-slot grammar**: the left side is contextual (Y over X), the
right side is navigation (B over A). Slots never disappear; they dim (§7.2).
Glyphs are 26 px spheres, 28 px for the emphasized Select slot, with a 9 px gap
to the label.

### 6.6 Open Tray

A wide pill anchored near the bottom of the left column with a large inset
shadow. An eject glyph (left-pointing triangle plus a 3 px bar, CSS shapes) sits
inside an 84 px circle that overlaps the pill's left cap. Pill and circle share
one hover state so the whole control reads as one item.

### 6.7 Media / ad slot

A large rounded rectangle reserved for dynamic content. When empty it is a
glossy striped placeholder with a monospace watermark label, sized by aspect
ratio and full width so it scales with its column. Filled, it is the branded
Xbox LIVE tile (`XboxLiveBanner`): the 2005 logo centered on flat `#616063`
with a 10 px radius, an inner shadow and a 1 px light rim. The Games Library
stacks it above its menu; the Xbox LIVE blade shows it under the menu with
`rings`, faint concentric green arcs fading in from the left edge. It is
never a cursor stop.

### 6.8 Controller glyph

A glossy sphere in the physical button color (§2.3) with the letter in bold at
60% of the diameter. Disabled: a flat `#E2E2E2` disc at 70% opacity with a
solid `#9B9B9B` ring and a `#8a8a8a` letter.

### 6.9 Detail panel and game list

**Game list.** A list of titles reuses the blade's divider-separated rows
(§6.2 `row` variant). Title artwork comes from `public/assets/games_pics/`
(64 px PNGs) shown at 36 px with a 4 px radius and no border. The cursor row
swells as well as lightening: the artwork scales to 150% from its left edge,
the label grows from 23 px to 30 px, and the gap between them widens, all
over 150 ms (`growOnFocus`). Blade menus keep their fixed rhythm. Hovering a
row highlights it for the panel and counter without moving the keyboard
cursor; Select (Enter, Space or A) commits the highlighted row by focusing
it and then launches the game. Launching navigates to the title's URL (one
shared URL in the mockup). Rows without a detail box or screen expose this
through `onSelect` on the menu item. A centered "N of M" counter in 22 px
sits at the foot of the column,
aligned with the base of the detail panel, and follows the cursor.

**Detail panel.** A tall rounded rectangle (10 px radius) beside the list,
stretching from under the tab strip to the counter's baseline. It is a
translucent lighter green, white at 12%, so the background's brightness
variation shows through. Inside, stacked bands replace rules:

1. A header strip ("Arcade Game") in the chrome-band tint, `bg-black/10`.
2. A brighter content band, white at 18%, with the title artwork at 72 px
   and two status lines.
3. The title's one-line blurb at 22 px on the transparent panel fill.
4. A second header strip ("Achievements").
5. A transparent body that fades into the panel.

The color shift is the separator. The edge is the raised button skin from
§6.2: the 1 px `#5a5a5a` border and the three one-sided inset bevel shadows
(`RAISED_BORDER` and `RAISED_INSET_SHADOW` in `MenuListItem.tsx`). Unlike
the buttons it has no hover, focus or disabled state. It is a readout, not a
control, and is never a cursor stop. Text inside is 24 px on the dark section
green.

### 6.10 Achievements screen

Opened by the Games blade's Achievements row (`AchievementsScreen.tsx`).
Same full-screen structure as the Games Library (§5.4): section gradient,
unclipped sheen, header and legend bands, the content raised as one slab.
The content is a 2×2 grid with the top-left cell empty:

- **Summary** (top right): a raised readout in the detail panel's skin
  (§6.9): the highlighted title's name on the first line, "N achievements"
  and the earned / total Gamerscore with the `G` badge on the second, all at
  24 px. While the cursor (focus or hover) is on a tile it shows that
  achievement instead: its name (with "Locked" in the soft ink if not yet
  earned), its description on up to two lines, and the Gamerscore it is
  worth with the `G` badge. It is never a cursor stop.
- **Game filter** (left, 17% wide): a column of icon-only blade rows
  (§6.2): "All Games" first with its glyph, then each title's art at 88 px.
  Hover or focus refilters the grid, as the console did; Select or Right
  moves the cursor into the grid.
- **Achievement grid** (right): six tiles across, square, 10 px radius, in
  the raised border and bevel on white at 8%. Unlocked achievements show
  their art with 12 px padding; locked ones show the trophy menu icon under
  a padlock (`lockedTrophy`, §6.2 finish) at three quarters of the tile.
  "All Games" lists only unlocked achievements, so it reads as the gamer's
  trophy case; its summary still counts the whole catalogue. The cursor
  is the pale grey wash at 55%, faded in over 150 ms. Left from the first
  column returns to the row that filtered the grid. Selecting a tile only
  plays Select A until the detail screen exists.

Both columns scroll behind a hidden scrollbar. While content runs past the
bottom, a small down-pointing triangle in `--blade-glyph` sits under the
column's right edge, as on the console.

Data (`achievements.ts`): Modern Warfare 3, Halo 3 and Midnight Club: Los
Angeles are the real lists (`mw3-achievements.ts`, `halo3-achievements.ts`,
`mcla-achievements.ts`, art under `public/assets/achievements/`), each entry
carrying a mock `unlocked` flag. All fold into "All Games". Title art comes
from `public/assets/games_pics/`. An achievement is only listed once it has
art, and a title is only listed once it has a scraped list. Art that fails to fetch, or
comes back empty, removes its item (tile or title row) from the screen and
from the counts rather than showing a broken image
(`onImageFetchFailed` in `AchievementsScreen.tsx`). Title art is optional and
falls back to the striped placeholder (§6.7) with the first word of the
name as its watermark.

### 6.11 Music screen

Opened by the Media blade's Music row (`MusicScreen.tsx`). Same full-screen
structure as the Games Library (§5.4) on the media blue: section gradient,
unclipped sheen, header band reading "Music", the content raised as one
slab, and a legend of Y/X dimmed, Back B and Select A. The content is two
columns, the left 45% wide:

- **Source list** (left): blade rows (§6.2 `row`). "Music Player" heads
  the list and is live: the cursor lands on it by default and opens the
  Music Library screen (§6.12). The sources below it sit on a slab in the
  chrome-band tint (`bg-black/10`, §5.2) with the corner facing the pane
  rounded 25 px, running to the bottom of the content, and are all
  disabled: Hard Drive and Computer because the catalogue now lives
  behind Music Player, Current Disc and Portable Device while nothing is
  inserted or attached.
- **Description pane** (right): the highlighted row's name at 30 px, its
  artwork, then the blurb at 24–26 px.

Every source row carries a glyph from the monochrome set (§6.2): Music
Player the `music` glyph, Current Disc the `disc`, and Hard Drive,
Computer and Portable Device their own drive, monitor and pocket player,
redrawn rather than waiting on the console's bitmaps. The pane's music
note is still a full-colour bitmap and shows a 120 px striped placeholder
(§6.7) until the image is dropped in.

### 6.12 Music Library screen

Opened by the Music screen's Music Player row (`MusicLibraryScreen.tsx`).
Same full-screen structure as the Games Library and My Games (§5.4):
section gradient, unclipped sheen, header and legend bands, the content
raised as one slab with `CONTENT_BAND_SHADOW`, 12% side padding. It is
painted in the Media blade's blue and sets `MEDIA_THEME` on its root so
the shared rows take the blue ink and rules (§2.2). The header reads
"Music Player"; the legend is Y Play All Music, X dimmed, Back B, A dimmed.

The body is two equal columns:

- **Categories** (left): Albums, Artists, Saved Playlists, Songs, Genres
  as blade rows (§6.2 `row`) with the `chevron` cue. Each carries a glyph
  from the monochrome set (§6.2): Albums the `music` glyph, Artists a
  microphone, Saved Playlists a list with a note, Songs a single note and
  Genres a guitar. Hover or focus on a category
  swaps the list beside it, as on the console; Select or Right moves the
  cursor into the list.
- **Entries** (right): the highlighted category's items as compact raised
  buttons (§6.2 `button`, `compact`) with an 8 px gap, in a scrolling
  column behind a hidden scrollbar (`ScrollColumn`, shared with §6.10). At
  its foot a "N of M" counter at 22 px sits on the left and the
  down-pointing more-below triangle on the right. Left from any entry
  returns the cursor to the category that owns the list. An album row
  opens that album's screen (§6.14), and an artist or a genre row the
  list of its albums (§6.21); the hand-written categories, Saved
  Playlists and Songs, play Select A only, since neither has a
  destination yet.

  Album rows carry their **cover art** in the 24 px icon box, in place
  of the neutral square, and artist rows their **photo** in the same box
  (`RowArt`). Genres have none: the store has no picture of a genre. The
  console showed art only on albums, because it read tags off a hard
  drive and a file carries its cover; a catalogue also knows what the
  artist looks like, and a 10-foot list of 48 names is exactly where a
  face is worth more than a word.

  Artwork, genre and the track listing all come from the **iTunes Search
  API**, which needs no key. `scripts/fetch-apple-music.mts` (`npm run
  album-data`) resolves each album once and writes
  `album-details.json`; the store's `collectionId` is then pasted back
  into `albums.ts`, so the app never searches at render time and a re-run
  is deterministic. Artwork is *linked*, not checked in: Apple's URLs
  carry the size in the path and are served CORS-open, so one stored URL
  serves every size the UI needs (`albumArtworkUrl`, plus
  `remotePatterns` in `next.config.ts`).

  Store search ranks editions ahead of originals and pulls in tributes by
  other artists, so the match is structural: the artist must match, the
  collection name must begin with the album's title, and remixes, live
  albums, karaoke and covers are rejected. Of what survives an exact
  name wins, else the fewest tracks — which picks the album over a deluxe
  edition padded with a bonus disc. Some albums are not in the store's
  search index at all; those keep the neutral square rather than take a
  wrong match, exactly as §6.10 prefers no art to broken art (though
  unlike there, the row stays: the art illustrates the title, it is not
  the item).

  **The artist photo is the one thing the Search API does not have.** A
  lookup of an artist entity returns the name, the link and the genre
  and no image field of any kind; the Apple Music API does carry
  `attributes.artwork`, but it needs a MusicKit developer token, which
  is the same reason this pipeline is the Search API in the first
  place. So the script reads the `og:image` of the artist's public
  page, whose URL (`artistViewUrl`) arrives with the album lookup it
  already makes — nothing guesses a URL. What comes back sits on the
  same `mzstatic` CDN as the sleeves, with the same size template in
  the path and the same CORS header, so at the point of use
  `artistImageUrl` is `albumArtworkUrl` with a different stored string
  (`artist-images.ts`, `artist-images.json`). It reads a page rather
  than an API, which is the weak point; Open Graph is metadata meant
  for other sites to read, so it is the most stable part of that page
  to depend on, and a miss costs a row its square and nothing else.
  "Various Artists" is the one name in the library with no photo: it is
  not an artist and has no page.

  **Three of the five categories are one list.** Albums, Artists and
  Genres are three readings of the same library, so none of them is
  written out: the albums are `ALBUMS`, the artists are its `artist`
  field, and the genres are the genre the store returned beside the
  artwork. Both are a grouping rather than a list of names
  (`AlbumGroup`, `ARTISTS` / `GENRES` in `album-details.ts`): a name
  and the albums under it, so the row already carries what its screen
  shows (§6.21). Groups sort the way the album list itself does — by
  letter, ignoring case, so Belanova precedes BROCKHAMPTON — and the
  albums inside a group keep `ALBUMS`' order, which is by title. A
  hand-written list of names would be a third copy of facts the payload
  already carries, and it would go stale the moment an album is added.
  An album with no artist or no genre falls back to the console's
  "Unknown Artist" / "Unknown Genre", so it still reaches a group
  rather than vanishing from the screen. Saved Playlists and Songs stay
  hand-written: no playlist exists yet, and a song list is the track
  listings rather than the albums.

Two highlight providers nest (`LibraryMenuProvider`): the outer follows
the category rows and picks the list, the inner follows the entries and
drives the counter, so hovering an entry never changes the category. The
list is keyed by category so a switch remounts it with the counter reset.

### 6.13 Pictures screen

Opened by the Media blade's Pictures row (`PicturesScreen.tsx`). Same
full-screen structure and Media blue as the Music screen (§6.11); the
header reads "Pictures", the legend is Y/X dimmed, Back B, Select A.

It is a source list rather than a grid, following the console: two
columns, a menu of the four picture sources on the left and a description
pane on the right (§6.4). Computer is the one source this mockup can
serve pictures from, so it alone is live and opens the picture browser
(§6.13.1); Digital Camera, Current Disc and Portable Device stay
disabled, the console's own way of showing a source with nothing plugged
into it. Each row carries a glyph from the monochrome set (§6.2): the
`computer` monitor, the `pictures` camera, the `disc`, and the pocket
player of `portableDevice` (shared with the Music screen's sources,
§6.11). The pane shows the highlighted source's own glyph, oversized and
centred above the blurb, in place of the bitmap placeholder the Music
screen's pane falls back to (§6.7): a source is a device, and the icon
set already draws every one of these devices.

### 6.13.1 Picture browser

Opened by the Computer row (`PictureBrowserScreen.tsx`). Same full-screen
structure as the Music Library and album screens (§6.12, §6.14) in the
same Media blue; the header names the source, "Computer", and the legend
is Y dimmed, X "Apply as Background" (unbound, the same live-but-unbound
kind of slot as the Marketplace blade's Sign Out, §6.19, since the mockup
has no background to apply one to), Back B and Select A.

Two columns, the left a fixed menu of one action, "Play Slideshow" — a
single blade row (§6.2 `row`), which already draws the dividers above and
below a list's only row. It opens the picture viewer (§6.13.2) at the
first picture.

The right column is the console's own **3×3 grid** of square tiles,
centred and bounded by the slab's height so the nine tiles stay square at
any viewport, with a 16 px gap. Tiles wear the Achievements tile skin
(§6.10): raised border and bevel on white at 8%, the pale grey wash at
55% as the cursor. A filled tile shows its picture edge to edge behind an
8 px inset with 6 px corners, and opens the viewer at that picture. Slots
past the end of the list show the striped placeholder (§6.7) watermarked
with the slot number, and stay cursor stops with `aria-disabled` (like an
`unavailable` row, §7.2) so the grid's D-pad arithmetic holds; Select on
them does nothing. A "N of M" counter under the grid follows the cursor,
counting only the real pictures and not the nine slots, as the console's
own counter did over a folder of eight photos in nine slots. Left from
the first column of tiles returns to Play Slideshow, and Right from it
enters the grid, the same handoff the album and Music Library screens
give their own two columns (§6.12, §6.14).

Pictures are the user's own: files dropped into `public/assets/demo-photos/`
and listed in `pictures.ts` (file name and caption). The grid shows the
first nine. The grid is `data-nav-list="3"` (§8): Up/Down step a row,
Left/Right a column.

### 6.13.2 Picture viewer

Opened by Play Slideshow or by a tile of the picture browser
(`PictureViewerScreen.tsx`), which is why it takes only a `startIndex`:
whichever row or tile opened it owns Back (`MenuListItem`, or the tile's
own copy of that pattern), and this screen only needs to say which
picture to open on. Unlike every other full-screen surface here, it is
not the blade structure at all: the console gave this one screen no
header, no blade chrome and no legend, because the photo is the whole
screen. `aria-modal` keeps the D-pad below it inert, and Back still
closes it, unannounced, the way the Music Player's own full-screen
visualization does (§6.16).

A floating transport bar sits centred in the lower third over the photo:
eight buttons — Pause/Play, Previous, Stop, Next, Shuffle, Repeat, Rotate
Left and Rotate Right — drawn as the Music Player's own simple monochrome
transport glyphs are (§6.16), and living with this screen for the same
reason: no other screen uses them, on a 5 px gap. The bar behind them is
one steel pill: a single light-to-dark grey fill in the neutral chrome
of §2.3, carrying the same pale top/bottom shine as the raised content
band's own light (Figma node 158:5, `CONTENT_BAND_SHADOW` in
`BladeChromeBand.tsx`), scaled down from a content band's height to a
36 px bar. A resting button has no fill of its own, so that shine shows
through it unbroken; the cursor (hover or focus) is a pale green fill
with a matching glow and corners that round out further than a resting
button's, so the selected control visibly pops off the strip. Under the
bar, a caption three quarters of the bar's own width and
centred beneath it names whichever button the cursor is on, its text
held to the left edge of that box, since the console labelled only the
one the cursor was on.

Every control really does something, in the spirit of the Music Player
(§6.16): the screen opens already advancing through the pictures on a
timer, which Pause/Play stops and restarts; Previous and Next step by
one; Stop returns to the first picture and pauses; Shuffle re-randomises
the advance order, as the Music Player's own sort reverses its queue;
Repeat decides whether reaching the last picture wraps to the first or
stops there; and Rotate Left and Rotate Right turn the picture on screen
a quarter turn, remembered per picture for the rest of the session. The
eight buttons are a `data-nav-list="8"` row, thus Left and Right already
step along them (§8).

### 6.14 Album screen

Opened by an album row in the Music Library list (`AlbumScreen.tsx`) —
Media blade → Music → Music Library → here. Same full-screen structure
and Media blue as §6.12.

The header is the album and its artist in parentheses, `Album (Artist)`.
The console put the record *label* there; no music file carries one, and
the artist is both the field a library really has and the one worth
reading from a couch.

It reuses §6.12's two-column grammar with the roles swapped. The left
column is a fixed menu of four blade rows (§6.2 `row`) — Play Album, Add
to Current Playlist, Edit Album Info, Delete Album — rather than a
filter. The right column is the track listing as compact raised buttons
(§6.2 `button`, `compact`) with the duration in the meta slot, in a
`ScrollColumn` with the "N of M" counter at its foot following the
cursor. Left/Right hand the cursor between the columns exactly as on
§6.12. Legend: Y and X dimmed, Back B, Select A.

Track listings come from MusicBrainz (`album-details.ts`), fetched by the
same script as the art (§6.12). Every row plays Select A only: there is
no player, no playlist and no tag editor yet.

### 6.15 Song screen

Opened by a track row on the album screen (`SongScreen.tsx`). Same
structure again, and the same left column of four actions — Play Song,
Add to Current Playlist, Edit Song Info, Delete Song.

What differs is the right column. Where §6.14 lists tracks, this is a
**readout** of one song's tags, so it takes the detail panel skin from
§6.9: translucent white at 12% over the section color, the 1 px border
and one-sided bevel (`RAISED_BORDER`, `RAISED_INSET_SHADOW`), and a
header strip in the chrome-band tint carrying the song's name. Below it
the music glyph, then the tags stacked as label-over-value pairs —
Artist, Album, Genre — the label at 20 px in the soft ink, the value at
24 px in the primary ink. The console's note here is a full-colour
bitmap and is not redrawn (§6.2); the icon set's own disc-and-note glyph
stands in. Like every §6.9 panel it is a readout, never a cursor stop.

The tags are album-level facts, so they come from the album the song sits
on. Genre is MusicBrainz's most-tagged genre for the release group,
capitalised for display since MusicBrainz records genres in lowercase.

Screens stack four deep here: Media blade → Music (§6.11) → Music
Library (§6.12) → album (§6.14) → song (§6.15). Each is its own portal
and Back peels off one at a time (§5.4).

### 6.16 Music Player

Opened by Play Song on the song screen (§6.15) or Play Album on the album
screen (§6.14) — `MusicPlayerScreen.tsx`. Same full-screen structure and
Media blue as the rest of the chain, which now runs five deep: Media
blade → Music → Music Library → album → song → player.

Two columns. The **left** is the player, gathered into one raised panel
(§6.9 skin): a row of five transport buttons — pause/play, previous,
stop, next, and a sort that reverses the queue — then the wide "Edit or
Save Playlist" button, then the now-playing plate. That plate is a dark
frame carrying the artist over the title in bold, the visualizer beneath,
and the LB / RB bumper hints in its bottom corners. The transport glyphs
are simple monochrome shapes, so unlike the console's bitmaps they *are*
redrawn (§6.2), as inline SVG in the icon set's finish; they live with
this screen rather than in `MenuIcons.tsx`, which is the menu-row set.

The **right** is the queue: "Current Playlist" at 30 px over the same
compact raised rows the album screen uses (§6.2 `button`, `compact`) with
the duration in the meta slot, and the "N of M" counter at the foot. The
track in progress is marked with a play triangle in its icon slot; the
rest carry `icon={null}`.

The left column is not one list, so Up/Down hand the cursor between the
transport row and the button under it, and Left/Right between the two
columns; the transport row is a 5-wide grid, so §8's D-pad already walks
it with Left/Right.

Y and X are live here — the first screen in the chain whose contextual
legend slots are bound rather than dimmed (§6.5). Y toggles the
visualization, X opens it full-screen, and that overlay owns its own
Back, so one press peels it off before the player (§5.4).

**It really plays.** Every track carries the store's 30-second preview
(§6.12), served with `Access-Control-Allow-Origin: *`. With
`crossOrigin="anonymous"` on the `<audio>` element its samples are
readable, so a Web Audio `AnalyserNode` can see them and the visualizer
shows the spectrum of the actual audio (`use-audio-spectrum.ts`). That
header is the whole reason this is possible: without it the preview would
still play, but `getByteFrequencyData` would return zeros and the bars
would sit flat. Thirty seconds is all the store gives, so a track ends
early and the queue advances — the preview's limit, not a placeholder.
A browser will not start audio without a user gesture; opening the screen
is one, and a refused play leaves the transport showing Play rather than
lying about it.

The spectrum reaches the visualizer as one `Float32Array` mutated in
place, never as React state: it moves sixty times a second.

**The background answers the bass too.** The visualizer is a box in the
corner of one screen and the music is the whole reason the screen is up,
so the section gradient itself moves with the low end. One envelope,
taken from the bands under 180 Hz, does three things to it
(`blade-pulse.ts`): it blooms the stops outward from the focal point, so
the bright core grows; it swings the hue about the grey axis, which
leaves the luma to the third; and it lifts the brightness. All three are
small, because the gradient is the section's identity (§2.1) — the bass
is allowed to move it, not to replace it, and at full scale Media is
still plainly the blue blade.

It reads the **loudest** bass band rather than their mean: a kick lives
in one or two of them and the bands under 40 Hz are usually empty in a
store preview, so an average dilutes every hit with silence. The
envelope rises fast and falls slowly, over about a fifth of a second,
which is what makes a kick read as the panel breathing rather than as a
strobe; it cannot flicker faster than a couple of hertz whatever the
music does. Under `prefers-reduced-motion` it is zero, because a
full-screen surface that moves with the audio is precisely what that
preference is asking not to see (§7.4). Y turns it off with the rest of
the visualization, and where the shader is not running the CSS gradient
simply stays put (§3.1).

The envelope lives in a module-level store rather than in context, for
the reason the water's tuning does: its readers are `BladeWaterRenderer`
instances and there are several at once (§5.4), so the gradient under
the player and the blade still showing behind it swell together instead
of drifting apart. Nothing has to tell the store that the music stopped
— the fall is computed from elapsed time, so a surface that reads it
while nothing is playing finds its way back to the plain section color
on its own.

**A beat is not an onset.** The envelope above, and the drops Water
lands, both answer a transient: something crossed a threshold, so
something moves — and the answer is necessarily as late as the detector
needed in order to be sure. A *phase* is the other thing: where the
music is between two beats. It is what lets a visualizer act **on** a
beat instead of after one, and nothing in the player had it.

`beat-clock.ts` infers one. It keeps the recent onsets, each with a
strength and a time, and evaluates a single term of a Fourier transform
of that train of events at each candidate tempo: for a period P it sums
`w · exp(i·2π·t/P)`. The magnitude of that sum says how tightly the
onsets cluster at one position within a bar of that period, which is
what it means for a tempo to fit; the argument says where that position
is, which is the phase. One quantity, and both halves fall out of it —
no rule anywhere says what a beat looks like.

Two corrections are needed on top. A transform of events prefers the
**fastest** period that fits, since onsets a half-period apart cancel at
1/P and align at 2/P, so a 100 BPM song also scores at 200 — the octave
error every tempo tracker has. A log-normal prior around 120 BPM settles
it, and hysteresis keeps the estimate from changing octave because one
bar was busy. And the onsets it reads come from an **adaptive** gate:
the fixed `ONSET_RATIO` of §6.16's drops is tuned for one kind of track,
so the detector measures its own rate of events and moves the threshold
to hold it near a target. That idea is Geiss's (1998) — its beat
detector counted the beats of the last thirty frames and moved the
multiplier of its threshold with that count — and it is in its source,
commented out. The visible drops keep the fixed gate, because there the
threshold is part of a tuned picture.

**Confidence is what makes it safe.** A preview of speech, of ambient
music or of a fade has no beat, and a clock that invents one is worse
than no clock, so the normalised magnitude — 1 when every onset lands at
one phase, near 0 when they are spread — is published beside the tempo,
and a reader below `BEAT_LOCKED` must use the reactive behaviour it had
before. It is a module-level store for the reason the pulse is, and it
needs telling nothing when the music stops for the reason the pulse
doesn't: the weight of an onset falls with its age, so the evidence
decays, the confidence goes to zero, and a reader that asks in silence
finds no beat.

The visualizer (`MusicVisualizer.tsx`) is drawn as a hardware **LED
spectrum analyser** — a matrix of discrete cells lit from the bottom of
each column, the way a rack graphic EQ does it — on a near-black plate,
deliberately the one surface not in the section palette, since on the
console it was a graphic effect rather than chrome. Three details are
what make it read as hardware rather than as a chart: unlit cells keep a
faint cool tint, so the whole matrix is visible at rest and a quiet
passage is a dim panel rather than an empty box; colour comes from the
*row*, blue through violet to amber and red, so a band is red because it
is high, not because of its frequency; and each column holds its loudest
recent cell and lets it sink slowly, which is the detached dot floating
above a column on a real unit. Lit cells are composited with `lighter`
and a bloom that spills just past the cell but never fills the gap,
which buys the panel's glow without an expensive blur.

Columns run left to right by frequency, bass at the left, as the
hardware does.

The Curl Field is the particle system the `/particles` page runs, shared
from `app/_particles/` rather than reimplemented: particles are born on a
sphere at the latitude of the band that spawned them, carried by a
**divergence-free curl noise field** integrated on the GPU, and fade out.

It is the one visualizer where the four-stop ramp means **frequency**
rather than level — blue is bass, red is treble — with loudness moved to
intensity. Colouring by level made it unreadable: brightness decays over
a particle's life, so every particle swept the whole ramp as it died and
the colour ended up encoding age, identically for every band. Hue is
also the only channel that survives the flow, since a particle's birth
latitude is advected away within a fraction of its lifetime while its
band travels with it.
**The pool is what a frame costs.** A curl is six samples of a
three-component potential, so 18 noise calls per particle per frame, and
every particle is also an additive sprite. Neither scales with the
canvas — `gl_PointSize` is in pixels, so a postcard-sized tile would pay
a full window's fill — so the tile asks for a smaller pool than the
full-screen copy and the point size follows the height of the mount.
Only one of the two is ever mounted: the tile stands down while the
full-screen copy is up, since a second field simulating behind an opaque
overlay is the one cost with nothing at all to show for it.

The field is shared because nothing about it is specific to where the
spectrum came from — the caller hands over a `sample` function that
fills a band array, which here reads the live analyser and on
`/particles` advances an offline transform of a decoded preview.
Orbiting is off here: a pointer-grabbing canvas has no business in a
10-foot UI (§8), so the view drifts on its own instead.

**The field's knobs also wander on their own**, a random walk of about
two percent of each value a second (`useDrift`), so the effect keeps
changing without anyone touching it. That walk runs from the *scene*,
not from a panel — the dashboard shows no tuning overlay at all
(`SHOW_VISUALIZER_CONTROLS`, off, because a 10-foot UI has no controls),
and the field still has to breathe there. `/particles` keeps its panel,
where the same switch turns the walk off; both read one store, so a
value set in either shows in the other.

**LB and RB cycle the visualizer** (`1` and `2` on the keyboard, §8), as
the console's did. There are eleven, all reading the same band array —
so switching costs nothing and needs no second analyser
(`visualizer-styles.ts`): the LED matrix, a pair of mirrored continuous
bars, which is what the console itself drew, a radial ring whose spokes
grow outward from the centre, **Water**, a **Spectrogram**, a **Grid**,
a **Curl Field**, a raymarched **Core**, **Warp**, **Harlequin**, and
**Mandelbrot**.

Water (`WaterVisualizer.tsx`) is the same WebGL wave field the blade
background uses (§3.1), with the music dropping the stones. No physics
is added: `ripplePacket` is already a damped radial sinusoid under a
Gaussian envelope, which is the shape a drop makes, so this only decides
when and where one lands. `audio-drops.ts` watches each band for an
*onset* — a jump above its own rolling mean, not a level, or a loud band
would fire sixty drops a second. Cooldowns rise with frequency and no
more than two drops land per frame, because otherwise cymbals would
flush the budget and erase the bass swell.

**How many ripples can be in flight is the constraint that shapes the
rest.** A ripple is visible for about two seconds, so capacity divided
by that life is the only drop rate the field can sustain. Sixteen slots
recycled one every 110 ms in a busy passage, which cut every wave almost
as soon as it started and read as the animation being chopped rather
than decaying. So the shader's array is sized for the visualizer's
needs (`MAX_DROPS`, 48) while the slow surfaces declare a smaller
capacity of their own and keep their original cost — `surface()` breaks
at `uDropCount`, so an oversized array is free to the surfaces that do
not fill it.

Within that budget the visualizer allocates slots rather than ringing
through them: it takes an unused or faded one, and when every ripple is
still live it would rather **miss a hit** than truncate a visible wave,
since a dropped onset is invisible and a cut wave is not. A drop loud
enough still displaces the quietest live one, so a kick is never refused
because a faded tick is nominally ringing, and a minimum gap between
drops stops one loud bar from spending the whole budget in three frames.

The bands themselves are spaced **logarithmically**, about a third of an
octave each, over 30 Hz to 14 kHz (`use-audio-spectrum.ts`). Splitting
the FFT's bins evenly is the obvious thing and it is wrong: it puts
everything from 20 to 470 Hz in one band, so the whole bass register —
where a kick, a bass line and most of the rhythm live — gets a
twenty-eighth of the display while twenty-seven bands share the upper
harmonics, and the result looks unrelated to the music because the part
you can feel is not resolved at all. Log spacing gives 20–250 Hz ten
bands of its own, and since radius follows band index they land inside
the middle third: the bass animates the centre. It needs `fftSize`
4096 — at 1024 a bin is 47 Hz wide, which cannot tell 40 Hz from 80 Hz.

Each band then sets three properties of its drop: **where** it lands
(bass at the centre, treble at the rim, each band keeping its own
direction so a sound is always tied to a place), **how hard** (the
band's level becomes `strength`), and **how tight its rings are**. That last one is
why the shared field gained `uDropK`, a per-drop wavenumber carried as a
multiplier of `uK`: a `vec4` had no room left for it, and with one global
`uK` a kick and a cymbal would ring at identical spacing and differ only
in size. Viscous damping goes as k², so a short-wavelength drop also
dies faster on its own — the cymbal's ripple is brief and the kick's
lingers, for free. Colour comes from the surface's **slope**, not its
height, so flat water reads black and only the moving rings light up.

The Spectrogram (`SpectrogramVisualizer.tsx`) is the spectrum's own
history: each row is one snapshot of the 28 bands as a polyline, a new
row is laid down every 70 ms and the older ones step back, so the
display reads front-to-back as *time* and left-to-right as *frequency*.
**The rows arrive at a rate; they do not move at one.** A push shifts
every row back a full gap at once, so on its own the whole image steps
fourteen times a second and reads as a renderer at fourteen frames a
second. Between pushes the stack therefore glides back by the fraction
of the interval that has passed, and the push cancels that offset
exactly — a row becomes one age older, which is one gap back, as the
offset returns to zero. One assignment a frame, and the rate stays a
rate.
A ridge running away from you is a note holding; a lone spike that
recedes and dims is a hit that has passed. Forty-eight rows at that
interval is about three seconds of history.

It is drawn **orthographically**, which is the one thing that has to be
right: a perspective camera converges the rows toward a vanishing point,
turning the time axis into a horizon and making the oldest rows
unreadable exactly where there are most of them. A parallel projection
keeps every row the same width, so age reads purely as position and
brightness — and framing becomes one number instead of a
camera-distance puzzle. The camera sits mostly front-on and tipped left,
because side-on would put the frequency axis and the time axis on the
same diagonal and the two would be impossible to tell apart. Lines are
1 px, since WebGL ignores `linewidth` almost everywhere; additive
blending on the near-black panel carries them instead, and crossing rows
brighten where they overlap.

The spectrogram has more worth tuning than the others put together — row
count, how often a row is laid down, peak height, row spacing, trail
fade, brightness, and the camera's azimuth and elevation — so it carries
its own overlay (`SpectrogramControls`, fed by
`spectrogram-controls.ts`), mounted only while it is the visualizer on
screen. Camera *angles* rather than a position, because "azimuth 20
degrees" is something you can reason about and `(-7, 9, 20)` is not;
the projection is orthographic, so distance changes nothing and is not
exposed. Changing the row count reallocates the geometry; everything
else is picked up on the next row.

The Grid (`app/_particles/ParticleField.tsx`, wrapped by
`GridVisualizer.tsx`) is the same history the Spectrogram draws, read as
a **landscape** instead of a waterfall: one point per cell, x is time
with the newest slice at the lit front edge, z is frequency with the
bass nearest, and y is level. So a bass line is a ridge along the front,
a hi-hat pattern is a row of spikes at the back, and a drop is a cliff
across every band. It is points and not a surface, because a spectrogram
*is* a grid of discrete measurements and a skin over them would claim a
continuity between adjacent cells that nothing measured. Quiet cells are
hidden by the shader rather than removed from the buffer: the window
slides, so which cells are loud changes every few milliseconds and
rebuilding the geometry each frame would cost more than drawing nothing.

It is the grid view of `/particles`, shared the way the Curl Field and
the Core are — but shared as a **ring of slices plus a function that
advances it**, not as a `sample` callback, because this scene draws the
history itself and a caller that owns the history can also scrub it.
`/particles` hands over its offline window, which already is such a
ring; the player hands over one it fills from the live analyser.

**It lays down a row per frame.** Both this and the Spectrogram hit the
same wall — a new row moves the whole display, so at 70 ms the image
steps fourteen times a second and reads as fourteen frames a second, no
matter what the renderer is doing, and 1,344 points cannot be slow on a
machine where the raymarched Core is smooth. `/particles` advances a
slice every 5.8 ms, which is why the same scene looks fluid there.

They take opposite ways out, because the constraint differs. The
Spectrogram glides between rows and keeps its rate, since its depth in
time is a knob and `rebuild` rewrites every vertex at each push. This
one just pushes faster: `refresh` touches only a height and a level per
cell, and a row per frame is the source's own rate, since the analyser
gives exactly one reading per frame — anything slower throws readings
away. The price is that the depth becomes a frame count rather than an
interval, about 1.6 s at 60 fps, and here the motion is what the display
is for.

Orbiting is off here for the reason it is off on the Curl Field (§8), so
instead the view **sways** about its three-quarter angle rather than
turning full circle: x is time, and half of a full turn would show it
running backwards.

The Core (`app/_raymarch/`) is the only visualizer with **no geometry
at all**. Every other one draws points, lines or a mesh; this draws one
fullscreen quad and derives the whole image per pixel by marching a
signed distance function. The shape is not modelled, it is *generated*:
a sphere whose radius is displaced by octaves of gradient noise, so it
has detail at every scale you care to look at and none of it is stored.
The noise is the same chunk the curl field integrates (`app/_glsl/`),
which is why it was pulled out of there.

The audio drives it at **two spatial scales**, which is as much as a
surface can honestly show. Bass swells the whole body in broad slow
lumps; treble roughens it into a fine crust. Twenty-eight separate bands
cannot be read off a lump of rock — projecting them onto spherical
harmonics would be faithful and illegible — so the spectrum is folded
on the CPU into two energies plus a **spectral centroid**, and the
centroid picks the hue from the four-stop ramp: where the energy sits,
not how much of it there is. The envelopes rise fast and fall slowly, so
a hit inflates the core and it subsides rather than flickering.

**The core hangs in a tunnel.** Behind it, where a ray misses the rock,
is the classic polar corridor: a point's angle about the centre is the
coordinate along the wall and the **reciprocal of its radius** is the
coordinate into the screen, which is what a perspective divide does — so
the corridor recedes correctly without a camera, a matrix or a single
triangle. Rings cross it, lines run away down it, the flight carries it
past and every bass onset throws a ring of light down it that is gone
inside a fifth of a second.

**And it bends.** The bend is what makes the flight read as movement
rather than as a texture scrolling, and it only works if the
displacement **depends on depth**: shifting the whole screen by a
constant moves the vanishing point, which reads as the camera looking
sideways down a straight pipe. So each pixel moves by where the centre
line is at *its own* depth. A world offset at distance d projects
divided by d, and r is K / d, so dividing by d is multiplying by r —
that is the entire correction. The camera's own place on the curve is
subtracted from it, because it travels down the same line; without that
the bend washes out as the flight goes on.

That is a chicken and egg — the radius says how far ahead a pixel is,
and how far ahead it is says how much the path has moved it — so it is
solved by **fixed-point iteration**, six passes — a number that was
measured, not chosen. At the bend this ships with, two passes leave
half the frame unresolved and four leave 1.6%; six leaves 1.0%, and
ten, twenty and forty leave 0.7, 0.6 and 0.55. That floor is a core
near the vanishing point where the map is genuinely expansive rather
than slow, so no iteration count clears it.

That core sets the ceiling on Bend, and it is worth knowing before
turning it up: **the visible swing of the corridor and the radius of
the unresolved core are the same quantity**, both proportional to
amplitude × frequency × |Bend|, so more bend always drags the core out
with it — at 1 it reaches r = 0.3 and at 4 the edge of the frame. The
sign only mirrors the curve, so a corridor that leans left costs
exactly what the same one leaning right does. Raising the amplitude while lowering the frequency
is not a way out: it leaves the swing exactly where it was, because
what shows is how much the path changes across the *visible* depth,
not how big it is.

Three things then do most of the work, and the first is the largest by
far: the camera **banks** into a bend, in proportion to the path's
sideways derivative, the way an aircraft does; the wall carries rings
and lengthwise lines so there is something to *pass*, since a smooth
wall has no speed; and **exponential fog** on the distance ahead gives
the corridor a scale. The fog is on distance rather than on position
along the tunnel, which is what makes it black out the vanishing point
by itself — so there is no vignette here and no need for one.

The audio steers it. There is no stereo to take a left-right difference
from, since the preview is summed into one analyser, so the corridor is
steered by *where the energy sits*: the spectral centroid swings it
side to side, the balance of bass against treble lifts it, the total
low end adds to the flight speed, and every onset throws an extra roll
into the bank. The steer is smoothed, and it is faded in over depth so
it never bends what is right next to the camera — that would be a jerk,
not a turn. The flight is **integrated** rather than taken as time
times speed: the speed moves with the music, and multiplying a changing
speed by absolute time jumps the whole corridor every time it
changes.

It is all drawn in **view space**, on the marcher's own quad, and that is
the right frame precisely because a tunnel is symmetric about the axis
you look down: no amount of orbiting can slide it, so the corridor
always points at the camera and only the rock inside it turns. (A box
would have had to be a real box in world space, since corners have to be
somewhere.)

Both families of line are measured back into **screen distance** before
they are given a width — the rings by dividing out `d(depth)/dr`, the
lengthwise lines by the arc between them — which is what stops the
rings collapsing into aliased mush as they crowd toward the vanishing
point, and avoids `fwidth`, which needs an extension in GLSL ES 1.00.
The centre goes dark for the same reason: it is where the reciprocal
runs away, and darkening it is both the vanishing point and the cheapest
antialiasing there is.

The flashes are **onsets, not levels** — the low end jumping above its
own rolling mean — with a floor and a minimum gap, since a level test
would fire sixty rings a second. Each is stored as a *depth* rather than
a radius, so the scroll carries it outward on its own; it is given a
rush of its own on top, because at any flight speed anyone would want
the scroll moves it about a hundredth of the screen in a fifth of a
second. Tunnel and Tunnel flash are knobs like everything else here, so
the walk moves them too, and Tunnel at zero leaves the core on plain
black.

Two things about the marcher matter if it is ever changed. It is **not a
true distance field**: displacing a sphere's radius by noise breaks the
Lipschitz bound a real SDF guarantees, so a full step can overshoot
through the surface, and steps are scaled to just over half the reported
distance to compensate. And **cost is per pixel, not per object**:
seventy steps of multi-octave noise is about 2.4 G noise evaluations a
second in the player's tile and ten times that full-screen, which no
integrated GPU will do. So Resolution is a knob, applied through the
renderer's pixel ratio — the canvas keeps its CSS size and marches
fewer pixels, which on an image this soft is nearly invisible. The
silhouette bloom is free: the marcher already tracks how close each
missed ray passed.

Its knobs can wander like the curl field's, on the same one-second walk
run from the scene, but the player asks its own core to hold still
(`drift={false}`): these values are a tuned picture rather than a
starting point, and two percent a second leaves them inside a minute.
It is a prop rather than the store's default, so a core mounted
anywhere else still breathes — and the curl field beside it keeps its
walk either way, because there the values are a region to explore and
not something someone chose.

Warp (`WarpVisualizer.tsx`) is the one visualizer that **draws almost
nothing**. Every other style builds its picture again each frame out of
the band array of that moment; this one keeps a buffer, and each frame
it moves the whole image through a displacement field, dims it a little,
and draws one curve of the spectrum over the result. What is on screen
is therefore the last two seconds of the music, each frame of it pushed
further along the field by the frames that came after. Nothing models
the tunnels and flowers that come out of it — they are the path the
field traces, visible only because the image is slow to fade.

That is the Geiss screensaver's method (Ryan Geiss, 1998, BSD 3-Clause),
and it is here because the eight before it had **no feedback at all**.
It is also by a long way the cheapest of the ten: one texture read per
pixel, where the Core spends seventy steps of multi-octave noise. Depth
bought over time rather than over instructions.

Three of its decisions are worth keeping straight, and each is the
modern form of something the original had to build by hand:

- **The displacement is computed, not read.** Geiss could not afford a
  coordinate per pixel per frame, so it precomputed a "warp map" of six
  bytes per pixel — two for the source address, four for the weights of
  the bilinear blend of the 2×2 around it. That map is exactly what a
  `LINEAR` sampler does in one instruction, so the shader computes the
  coordinate and lets the hardware do the part that was expensive.
- **The buffer is half float.** Geiss carried the low eight bits its
  fixed-point divide discarded into the next pixel, which dithered the
  image for free. The problem that solved is real and is why this target
  is not 8-bit: a decay of 0.95 on a byte channel quantises, so dim
  trails stop at a value that cannot fall further and leave a fixed
  ghost. More bits is the same fix.
- **The beat changes the field; it does not shake it.** Geiss built its
  next map in the background, a row at a time, and switched to it at the
  next beat — so the *motion* of the image changed on a beat and then
  stayed changed. This is the use of a beat that needs a phase rather
  than an onset, and the reason the clock above exists. The time Geiss
  needed to build a map becomes `MIN_SWAP_S` here, since a field is six
  numbers and costs nothing to make: the wait is what the eye wants, not
  what the machine needs. Where the clock is not locked the swap falls
  back to a timer, which is what the original's crude broadband detector
  effectively gave it.

**A swap sorts two things, not one.** Geiss drew its mode — how the
image moves — separately from its waveform — the shape that feeds the
loop, and that is where most of its variety came from: the same ring
inside a perspective field reads as a tunnel of rings and inside a
spherical one as a ball, so two small catalogues cover far more ground
than one large one. Both are sorted here. The shapes are a **line**
(the spectrum above its own mirror) and a **ring** (the spectrum around
a circle, bass at the right); each is one closed loop whose two halves
read the same bands, so it is symmetric and closes with no seam —
which is the problem Geiss solved by blending the first fifty samples
of its circular wave into the last fifty.

The modes are the other catalogue, and the reading of Geiss's map
generator that matters is that **all eleven of its modes are the same
two numbers** — a radial scale and a turn — made a function of where
the pixel is. Its sphere is a scale that grows with the radius, its
tunnel one that falls with it, its ripples `sin(√r)`, its flower petals
a scale that follows the angle. So the field here carries one
*character* at a time: flat (a spiral), ripple, petals, or fuzzy
(gradient noise). One at a time because that is what a mode is — two
together average into mush — and the petal count is a whole number
because `sin(angle · n)` is continuous around the frame only for
integers; at 4.5 the field tears along the axis where `atan` wraps.

Between two swaps the image still answers the music: the bass opens the
zoom over whatever the field asks for, and the curve is drawn brighter
as the beat approaches — small, because a visualizer that flashes on
every beat is a strobe, but it is the one thing on screen that follows
the phase continuously, and a swap is too rare to show whether the clock
is right.

Harlequin (`HarlequinVisualizer.tsx`) is Warp with the dice taken out.
MilkDrop (Geiss, 1999) is the screensaver above two years later, with
the random field replaced by an authored one, and a `.milk` preset is
that authored field written down: a block of scalars, a `per_frame`
block that runs once a frame, and a `per_pixel` block that runs at each
vertex of a coarse mesh and sets the warp there. This is one of them —
`!mu$ - Rovastar - Harlequin's Fluid Wallpaper 3.milk`, by Rovastar and
mu$, from the thousand that BeatDrop ships
(`OfficialIncubo/BeatDrop-Music-Visualizer`, BSD 3-Clause; the presets
carry their authors' own terms). It is a **MilkDrop 1** preset, which is
what makes it portable at all: it has no `warp_` or `comp_` HLSL block,
so the whole effect is its equations.

`per_pixel_1` splits the frame at `5·rad³ = 1`, a circle at rad 0.585.
Inside it the zoom is `1 − 0.4·log(√2 − rad)`, a smooth lens running
from 0.86 at the centre to 1.07 at the boundary. Outside it the zoom is
about a tenth, so a pixel out there samples **ten frame widths away**,
and since the preset sets `bTexWrap`, what comes back is the frame
tiled ten times, sheared by a translation of up to 1.3 units and turned
by a rotation that reads the translation the line above it just wrote.
That tiling is the harlequin; the lens in the middle of it is the
fluid. Three seeds feed the loop each frame: a 100-sided disc that
samples the last frame through a red-to-green gradient — which is why
the picture is red and green — a red pinpoint at the centre, and the
waveform as a slowly turning circle. An animated 2.5% frame at the
border pushes fresh colour in at the edge, where the outer field is
waiting to eat it.

**The equations run in a vertex shader**, at the vertices of MilkDrop's
own 32×24 mesh (`milkdrop.ts`), and that is fidelity rather than
economy. Evaluating them per fragment is truer to the algebra and
false to the picture: neighbouring mesh vertices that disagree about
where to sample give the long smeared triangles the format is made of,
where an exact per-pixel answer at a zoom of a tenth gives aliased
noise. The same file holds the warp transform and the `bass`/`mid`/
`treb` convention, so a second port adds only its own equations.

**Two things in it are not the preset**, and both answer the same
problem: *it does not listen*. Its equations read `time` and nothing
else, and `fWaveScale` is 0.01, which flattens the waveform circle to a
plain ring. It is a wallpaper, as its name says, and a wallpaper in a
music player is a screensaver. So the circle carries the spectrum —
which is only the wave doing the job MilkDrop gave it, with the scale
the author turned down turned back up — and `bass_att` opens the outer
zoom by one term, in the idiom of the presets that do listen. Nothing
else is added; in particular there is no beat clock here, because
swapping fields on a beat is what Warp is for and a preset is one field
rather than a hand of them.

Its audio values are normalised the way MilkDrop's are: 1.0 is the
*usual* level of that band for the track playing, not a fraction of
full scale. An equation written as `zoom + 0.1·bass_att` assumes that,
so a port that hands it a 0..1 fraction gets a preset that barely
moves.

Mandelbrot (`MandelbrotVisualizer.tsx`) is the second visualizer with
**no geometry at all** — one fullscreen quad, like the Core, with the
per-pixel answer the escape time of `z → z² + c` rather than a march
through a distance field. It is in a music player because it already
has the shape every other style has to invent: the escape count falls
in **contours** around the set, one inside the next, as far in as
anyone cares to look. So the contours *are* the bands — the continuous
escape count, modulo a cycle, indexes the 28 of them, and contour k is
lit by band k. Hue therefore reads **frequency** here, as on the Curl
Field, and brightness reads level, as on the LED matrix. The cycle
folds back on itself, bass out to treble and back, because a ramp that
ran 0 to 1 and wrapped would draw a hard red-to-blue edge on every
contour.

The rest of the audio splits the way the Core's does, and for the same
reason — a surface can honestly show two spatial scales. **Bass flies
the camera**, adding to the rate of the dive; **treble lights the
filaments**, which are the fine crust the set hangs off its one mass;
and the middle crawls the contours outward. The dive and the crawl are
both **integrated** rather than taken as time × rate, since a rate that
moves multiplied by an absolute clock jumps the whole image every time
it changes.

**The dive ends, and that is `float`.** Twenty-four bits of mantissa
know a coordinate near 1 to about 1e-7, so two pixels collide once the
frame is a few times narrower than that: the picture bottoms out near
20,000×. Going deeper is a different program — a reference orbit
computed in double on the CPU, with each pixel iterating its *small*
difference from it, which is perturbation and is how the deep-zoom
renderers work. So the question is only what to do at the floor, and
Warp already answered it for its field: a state that changes **on** a
beat reads as an edit, and the same change at an arbitrary moment reads
as a fault. The dive holds at the floor until `beat-clock.ts` gives a
beat and cuts to a new target there; unlocked, it cuts on a timer.
Targets are published coordinates, hand-picked, because a point drawn
at random on the boundary is almost always a plain filament — the
places worth 20,000× are the ones people have already named.

Three details keep it honest at the cost of a tile. The main cardioid
and the period-2 bulb are tested in closed form and skipped, since
every pixel inside the set runs the loop to the cap and with the set in
frame that is most of the screen. The loop has a constant bound and
breaks at `uIter`, the way the wave field breaks at `uDropCount`, so a
deep frame buys its extra steps without the worst pixel becoming a
surprise. And the derivative `dz/dc` is carried beside `z`, which gives
the **distance to the set** — a filament is thinner than a pixel almost
everywhere, so a test on colour loses it and a test on distance does
not. Where the contours themselves crowd finer than a pixel, `fwidth`
fades them to the colour they average to: the spectral centroid at the
mean level, rather than moiré.

That overlay, the core's, the curl field's and the background water's
(§3.1) are all the same component, `TuningPanel` — a title, a table of
knobs and which corner to sit in are the only differences, and each was
about to grow its own copy of the collapse, the reset and the decimal
handling. The bumpers
are advertised by the hints in the panel's bottom corners rather than by
the legend, which is a four-slot grammar with no room for them (§6.5);
the current visualizer is named between them. They wrap, so there is no
end of the list to get stuck against.

The three canvas readings fall back to a synthesised signal when no
analyser is feeding them, and stop asking for frames when still. The
WebGL ones instead keep painting and **freeze their clock**, which comes
to the same thing on screen and avoids a canvas that goes blank: under
`prefers-reduced-motion` or while paused, the shape, the camera and the
spectrum all hold where they were. Warp and Harlequin are the exception
that proves the rule: their image *is* their buffer, so holding still
means stopping the loop and presenting that buffer once more, rather
than redrawing a frozen clock.

### 6.17 Controller sign-in toast

When a controller connects (`gamepadconnected`, §8), a toast reads
"<gamertag> signed in" and plays the notification cue (§7.3) —
`ControllerNotification.tsx`, mounted by `GamepadNav`. It lives 7 s in
total: a 1 s open, 5 s on screen and a 1 s close. It is `absolute` at a fixed
`bottom: 100px`, centred, `z-50` so it sits over the full-screen
surfaces too, and never takes pointer events or focus.

It is one container, the dark translucent pill (`rgba(44,52,40,.9)`,
2 px grey rim, 96 px tall), holding the logo and the text. The logo
fills the pill's height as a square, so the two are always the same
height; the text is the gamertag over "signed in" at 26 px in
`#dfe3da`. The logo is the controller's ring of light: four grey
quadrants split by a black cross, the pad's own quadrant lit green (pad
0 top left, then top right, bottom left, bottom right, the console's
player order). Inside the ring the icon alternates every 1.5 s between
the Xbox 360 ball (`public/assets/ball.png`) and the standing console,
crossfading over 300 ms.

It comes in as the console's did: the whole shape first shows as a
faint, blurred ghost, then the pill draws itself left to right over it
(a mask twice the pill's width, opaque on one half and faint on the
other, sliding across), and the whole ring glows green before settling
on the lit quadrant, all within the first second. The close is the open
backwards within the last second: the pill un-draws right to left, then
the ghost blurs and fades. Under
`prefers-reduced-motion` it simply shows. A second connect restarts it
rather than extending it.

### 6.18 System blade and Console Settings

The System blade (`page.tsx`) is purple (§2.1, `SYSTEM_THEME`) and, as
on the console, has no profile card: two columns, the menu and the
description pane. The menu is Console Settings, Family Settings,
Memory, Network Settings, Computers and Initial Setup, each with a
glyph from the monochrome set (§6.2) — the standing console, an adult
and a child, a memory unit, linked nodes, the monitor (shared with the
Music screen) and a seated player. The pane keeps a description's line
breaks (`whitespace-pre-line`), so Console Settings lists what it
covers as bullets. Console Settings opens its screen; the other rows
open a detail box until they have one.

The Console Settings screen (`ConsoleSettingsScreen.tsx`) is the song
screen's structure (§6.15) on the system purple: header band "Console
Settings", the content raised as one slab in two columns, and a legend
of Y and X dimmed, Back B and Select A. The left column is Display,
Audio, Language, Clock, Locale, Auto-Off, Screen Saver, Remote Control
and System Info as blade rows with **no icon** (`icon={null}`). The
right column is the highlighted row's pane: "Current Setting" over its
current values, a blank line, then the description. System Info has no
value, so its pane is the description alone. No setting changes yet;
each row plays Select A.

### 6.19 Marketplace blade

The store blade (`page.tsx`) is orange with a peach core (§2.1,
`STORE_THEME`) and, like System, has no profile card and no Open Tray:
two columns, the menu on the left and promotions where the description
pane would be.

The menu has **two tiers** in one keyboard column. The four stores —
Spotlight, New Arrivals, Game Store and Video Store — are the raised
buttons of the Games Library (§6.2 `button`), the large glyph
straddling the band split above and left of the label. Below them,
Redeem Code, Active Downloads and Account Management are plain blade
rows (§6.2 `row`) with their dividers. Down walks from the last tile
into the rows. Spotlight holds the cursor on open and is the one tile
with a real destination: it opens the Spotlight screen (§6.20). New
Arrivals, Game Store and Video Store, and the three rows below them,
still open a detail box (§5.3), since those stores do not exist yet.

The raised buttons take their label colour from `--blade-ink`, so the
same skin reads brown here, green on the Games Library and blue on the
Media screens.

The right column is not a readout of the highlighted row. It is a large
promo tile (the console ran Guitar Hero III and the Halo 3 theme song)
over the Xbox LIVE banner with `rings` (§6.7). The promo is a bitmap on
the console and shows the striped placeholder until art is dropped in;
neither is a cursor stop. Legend: Y dimmed, X Sign Out, B dimmed,
Select A.

### 6.20 Spotlight screen

Opened by the Marketplace blade's Spotlight tile (`SpotlightScreen.tsx`)
— the first of the four stores to become a real destination rather than
a placeholder detail box (§6.19). Same full-screen structure as the
Games Library (§5.4) in the Marketplace orange: section gradient,
unclipped sheen, header and legend bands, the content raised as one
slab.

A full-width `XboxLiveBanner` (§6.7) sits under the header, as on the
console. Below it is a **category carousel**: Games, Arcade, Demos,
Free Stuff, Videos and Movies as a row of plain text tabs (§5.5), masked
to fade at both edges and offset so a sliver of the trailing category
always shows through the left fade, the carousel's own wraparound. The
wrap is a look and not a loop: Left and Right still clamp at the ends
of the category list, exactly as they do on every other tab strip (§8),
and the wrapped sliver is never a cursor stop. A category change
refilters the list below it and returns the cursor to its first row,
exactly as the My Games tab strip does (§6.9).

The body under the carousel repeats the Games list/detail grammar with
two differences that set Marketplace content apart from a title the
gamer owns:

- **List rows carry no icon** (`icon={null}`, §6.2) and stack two lines
  of text instead of one: the item's name, then its content type
  ("Game", "Downloaded Content", "Gamer Picture", …) in the soft ink
  below it. `MenuListItem` gained a `subtitle` prop for this row shape,
  since every other menu row is single-line.
- **The detail panel is a readout** (§6.9 skin, `RAISED_BORDER` /
  `RAISED_INSET_SHADOW`), not the two-band status card of My Games: a
  darker title strip naming the item, an empty media slot (§6.7)
  standing in for the box art or the price the console showed there,
  and the item's blurb. The blurb is not scrolled: the panel's height is
  fixed and `overflow-hidden` clips the text where it runs past the
  bottom, exactly as the console cut its last line off mid-character
  rather than fading or scrolling it.

A "N of M" counter follows the cursor at the foot of the list, as in My
Games. Selecting an item only plays Select A, since there is no product
page yet (§6.19). The legend shows all four buttons live — Y
"Marketplace Home", X "Add Microsoft Points", Back B and Select A — as
the console did. Y and X are not wired to a key: those destinations do
not exist yet, the same reason the blade-level "Sign Out" slot is live
but unbound (§6.19).

### 6.21 Artist and genre screen

Opened by a row of the Artists or the Genres category of the Music
Library list (`AlbumGroupScreen.tsx`) — Media blade → Music → Music
Library → here → an album (§6.14). Same full-screen structure and Media
blue as the rest of the chain (§5.4, §6.12); the header is the artist's
or the genre's name, the legend is Y/X dimmed, Back B, Select A.

**One screen serves both**, because an artist and a genre are the same
fact here — an `AlbumGroup`: a name, and the albums under it. Only the
header and the screen-reader labels differ, through one `kind` prop.

**The albums are the library's, not the store's.** Apple has an artist
endpoint that returns a full discography; that is the wrong set. The
console listed the records the gamer *had*, and grouping `ALBUMS`
(§6.12) gives exactly those, for free, with no second request, no key
and no way to disagree with the album list the screen above it shows.
The store is worth asking only for something the library genuinely
lacks — artist artwork, a biography — and that needs a MusicKit
developer token, which is the same reason the fetch script uses iTunes
Search rather than the Apple Music API.

It takes the **Music screen's** two-column grammar (§6.11), a list left
and a pane right, rather than the album screen's (§6.14), because there
is no column of actions to offer: the player is bound to one album
(§6.16), so "Play Artist" would have to build a queue across albums.

- **Album list** (left, 45% wide): the group's albums as compact raised
  buttons (§6.2 `button`, `compact`) carrying their cover art in the
  24 px icon box, exactly the rows of §6.12, in a `ScrollColumn` with
  the "N of M" counter at its foot following the cursor. Each row opens
  that album's screen (§6.14). It is the only column with a cursor, so
  Left/Right do nothing here.
- **Pane** (right): a hero image at 220 px, then the album the cursor
  is on. **The hero is the subject of the screen**: on an artist screen
  it is the artist's photo (§6.12) and holds still while the cursor
  runs down their records, with the highlighted album below it at row
  size, so the pane reads "this artist, this record of theirs". A genre
  has no such subject — the store has no picture of one — so there the
  hero is the highlighted album's own sleeve and it moves with the
  cursor. An artist with no photo falls back to the striped placeholder
  (§6.7) rather than to a sleeve, because swapping a record into the
  hero would make it move with the cursor on one artist and not on the
  next. Under it, the title at 30 px and the facts the library holds,
  stacked label-over-value as the song screen stacks its tags (§6.15).
  Genre shows on an artist screen only; on a genre screen every row has
  the header's genre, so printing it under each one would say nothing,
  and that screen shows the artist instead. The pane is a readout,
  never a cursor stop.

Screens now stack six deep on this path: Media blade → Music (§6.11) →
Music Library (§6.12) → artist or genre (§6.21) → album (§6.14) → song
(§6.15) → player (§6.16). Each is its own portal and Back peels off one
at a time (§5.4).

---

## 7. States and feedback

### 7.1 Cursor

State is shown through **contrast only**. The cursor is real DOM focus, so
`focus-visible` styles double as the cursor and match the hover look. The
highlighted row takes a pale grey wash, a left-to-right ramp to solid on
raised buttons and a centred band on list rows (§6.2); live rows keep their
resting skin. Transitions are 150 ms on color, border, shadow and
background (opacity, for the washes).

### 7.2 Disabled ≠ hidden

Disabled elements keep their shape and position and fade:

- Legend slots swap to the flat gray glyph and drop their label.
- Rows keep their bevel with the border at 50%, the band at 40% opacity, and
  text in low-contrast green `#8fd36a`. Use the native `disabled` attribute, not
  a dimming class, so the D-pad skips them.
- Disabled icons dim with the text (40% opacity), since the SVGs carry their
  own colors.

A row the console lets the cursor land on *to explain* why it cannot be
used yet (Music Player before a source is chosen, §6.11) is `unavailable`
rather than `disabled`: the icon and label fade the same way, but the row
stays a cursor stop, takes the wash, updates the description pane and is
`aria-disabled`. Select does nothing on it.

### 7.3 Sound

Every cue maps to a controller action (`sounds.ts`):

| Cue | When |
| --- | --- |
| Select | Cursor lands on a selectable item (hover or arrow) |
| Select A | Confirming an item |
| Back | Leaving a screen you can actually leave (ESC, B, `×`, backdrop) |
| Page Left / Right | Switching blades toward the left / right |
| Notification | A notification toast appears (controller signed in, §6.17) |

Back is only listened for while something is open, so it is silent when there
is nothing to go back from. Replaying a cue restarts it; different cues overlap.

Cues play through one Web Audio context from buffers decoded up front,
so each starts on its first sample the moment it is asked for. The
browser keeps that context silent until the page gets a real user
activation — a click, a tap or a key press. Controller input is not
one in any browser and nothing in the page can make it one, so a
session that only the controller has touched is silent until the first
click or key press; after that every cue plays, whatever device sent
it. A cue asked for while the audio is still locked is dropped rather
than queued, so unlocking never releases a burst of stale sounds.

### 7.4 Blade transition

Switching blades re-deals the hand rather than cutting. Everything moves on
one tempo, 350 ms with `cubic-bezier(.4,0,.2,1)` (`blade-motion.ts`):

- The panel's clip-path glides to its new edges; the tabs slide to their
  new slots and flip their curve if they cross stacks; the gutters widen
  and narrow; the content padding follows. All are CSS transitions on
  geometry, possible because every edge is sampled with the same vertex
  count.
- The section color interpolates per stop in the surface shader (§3.1),
  eased on the same curve as the geometry, so the gradient itself moves
  from one section to the next. Switching again mid-transition picks up
  the color on screen rather than snapping back. Where the shader is not
  running, CSS cannot interpolate two gradients, so the fallback paints
  the previous section color over the panel and fades it out over the
  same 350 ms.
- The new blade's content mounts and lands from the direction of travel:
  28 px from the right when moving right, from the left when moving left,
  fading in over 350 ms after a one-third-tempo delay so the chrome is seen
  moving first.
- Page Left / Right sounds (§7.3) fire at the start of the move.
- Under `prefers-reduced-motion` every part cuts instantly. The moving
  parts carry the `blade-motion` class (`app/globals.css`), which the media
  query uses to cancel their inline transitions and animations; the fading
  color copy is hidden outright so it cannot linger. The surface shader
  watches the same media query: its tween collapses to a cut, and the
  water stops — with time frozen the sheet is perfectly still, which in
  this shading means perfectly transparent, so the blade is simply its
  gradient. It then stops asking for frames entirely.

The tempo's easing lives as control points in `blade-motion.ts`, with the
CSS `cubic-bezier(...)` derived from them, because the shader has to ease
its half of the switch on exactly the same curve as the CSS transitions.

---

## 8. Input model

Keys map to the controller (`keys.ts`): Space, Enter or A is the A button;
Escape or B is the B button; Y and X are their own letters; the shoulder
bumpers are `1` and `2`, since there are no letters to borrow and the
number row sits where the bumpers do. Y and X are
bound only by the screen that lights those legend slots — the Music
Player (§6.16) is the only one so far — because a dimmed slot (§7.2) must
not answer a key. The global D-pad (`KeyboardNav.tsx`) works off two data
attributes:

- `data-nav-list="column"` (or a number N for an N-wide grid) on a container.
- `data-nav-item` on each focusable entry.

Up/Down step through a column (or by N in a grid). Left/Right switch blades,
except inside a grid or under a modal. Movement clamps at the ends and plays
Select. Every navigable element, including tabs and the gamer picture, is a
`data-nav-item`.

A real controller drives the same keys (`GamepadNav.tsx`). The left stick
and the D-pad are the arrows, A/B/X/Y their letters, LB/RB `1`/`2`; each
becomes a `keydown` on the focused element, so every handler above
answers it exactly as it answers the keyboard. The rules live in the pure
`gamepad-input.ts`: fire on the press edge only, a stick deadzone of 0.5
with release at 0.35, the dominant axis on a diagonal, and a 300 ms /
100 ms repeat for a held direction, standing in for the OS key repeat the
arrows rely on. Buttons do not repeat. Only pads with the `standard`
mapping are read.

---

## 9. Code conventions

- Tailwind v4. Spell out arbitrary values as full literal class strings; the
  compiler only generates what it can read verbatim.
- Complex gradients and multi-layer shadows go in inline `style`, not classes.
- Reuse the shared constants (`blade-layout.ts`, `blade-curve.ts`,
  `blade-theme.ts`, the `BladeSection` gradients) instead of re-typing
  values. Section-dependent colors go through the `--blade-*` variables,
  written as Tailwind's `text-(--blade-ink)` form.
- Interactive things are real `<button>`s with proper roles and labels;
  navigation is `<aside><nav><ul>`.
- Every component opens with a JSDoc block citing the section here it
  implements and explaining the why, not just the what.
