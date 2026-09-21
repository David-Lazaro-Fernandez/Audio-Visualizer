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
panel renders. Games, Xbox LIVE and Media are built; store and system show a
titled, empty panel with every legend slot dimmed until they are.

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

Store (orange) and system (steel) carry placeholder gradients of the same
structure until those blades are designed. The
Nova mockups also define steel (system task blade) and gold (decision
dialog) surfaces for overlays; use the same radial structure when adding them.

### 2.2 Text on section color

Text, rules and small glyphs on a blade are tints of its own section color.
Each `BladeSection` carries them as a `BladeTheme` (`blade-theme.ts`), which
`BladeCanvas` sets as CSS variables; the shared components read the
variables rather than literal greens. The section layout sets the games
values as the default, so full-screen surfaces (which portal outside the
canvas) stay green unless they set another theme on their root, as the
Audiobooks screen does with `MEDIA_THEME`.

| Role | Variable | Green (games) | Gold (Xbox LIVE) | Blue (media) |
| --- | --- | --- | --- | --- |
| Primary text | `--blade-ink` | `#17300a` | `#2a1a04` | `#0a2240` |
| Secondary / meta text | `--blade-ink-soft` | `#1f3b0d` | `#3d2707` | `#123056` |
| Row divider lines (3 px) | `--blade-rule` | `#379226` | `#f2c66a` | `#7cc4f2` |
| List top/bottom rule (2 px) | `--blade-rule-strong` | `#43AB33` | `#f7d585` | `#a3d7f7` |
| Eject glyph, rest / cursor | `--blade-glyph` / `--blade-glyph-hover` | `#3e941d` / `#1f5c0c` | `#a86a12` / `#5e3a06` | `#2a74b8` / `#143f6e` |
| Placeholder watermark | `--blade-watermark` | `#2b4a12` | `#5a3a0a` | `#123a60` |

Rules are darker than the panel on Games and lighter on Xbox LIVE and
Media, following the console: the dividers read as shadow lines on green
and as pale lines on gold and blue.

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
   kills the banding the CSS version shows across a wide panel.
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
the blade's Music row opens the Music screen (§6.11), whose Hard Drive row
opens the Audiobooks screen (§6.12), and the Pictures row opens the
Pictures grid (§6.13). Each is
its own portal, so later screens simply paint over earlier ones. Back (ESC / B) is
arbitrated by a module-level stack (`back-stack.ts`): only the topmost open
surface answers, so one press peels off one screen.

The portal root sits outside the canvas, so a surface opened from a blade
other than Games sets its own section theme (§2.2) on its root, as the
Music screen does with the media blue.

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
  console's cue that the row has a list to its right (Audiobooks, §6.12).
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
  browse list (Audiobooks' albums, §6.12), where the full button is too tall
  to stack a dozen deep.
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
row, plus the Marketplace "m" roundel, currently unused. Icons that are
full-colour bitmaps on the console (Media Center's Windows flag, title
art, achievement art) are not redrawn in this finish: the row takes an
`<Image>` node from `public/assets/` as its `icon` instead, and shows the
striped placeholder (§6.7) until the bitmap is available.

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
  the list as an `unavailable` row (§7.2): the cursor lands on it by
  default and the pane explains that a source has to be chosen first. The
  sources below it sit on a slab in the chrome-band tint (`bg-black/10`,
  §5.2) with the corner facing the pane rounded 25 px, running to the
  bottom of the content: Hard Drive and Computer live, Current Disc and
  Portable Device disabled while nothing is inserted or attached.
- **Description pane** (right): the highlighted row's name at 30 px, its
  artwork, then the blurb at 24–26 px.

The console's source icons (hard drive, monitor, USB plug) and the pane's
music note are full-colour bitmaps and are not redrawn (§6.2): those rows
show the neutral square and the pane a 120 px striped placeholder (§6.7)
until the images are dropped in. Music Player reuses the `music` glyph and
Current Disc the `disc` glyph. Hard Drive opens the Audiobooks screen (§6.12).

### 6.12 Audiobooks screen

Opened by the Music screen's Hard Drive row (`AudiobooksScreen.tsx`).
Same full-screen structure as the Games Library and My Games (§5.4):
section gradient, unclipped sheen, header and legend bands, the content
raised as one slab with `CONTENT_BAND_SHADOW`, 12% side padding. It is
painted in the Media blade's blue and sets `MEDIA_THEME` on its root so
the shared rows take the blue ink and rules (§2.2). The header reads
"Audiobooks"; the legend is Y Play All Music, X dimmed, Back B, A dimmed.

The body is two equal columns:

- **Categories** (left): Albums, Artists, Saved Playlists, Songs, Genres
  as blade rows (§6.2 `row`) with the `chevron` cue. The console's
  category glyphs are full-colour bitmaps and are not redrawn (§6.2): the
  rows show the neutral square until the images are dropped in, except
  Albums, which reuses the `music` glyph. Hover or focus on a category
  swaps the list beside it, as on the console; Select or Right moves the
  cursor into the list.
- **Entries** (right): the highlighted category's items as compact raised
  buttons (§6.2 `button`, `compact`) with an 8 px gap, in a scrolling
  column behind a hidden scrollbar (`ScrollColumn`, shared with §6.10). At
  its foot a "N of M" counter at 22 px sits on the left and the
  down-pointing more-below triangle on the right. Left from any entry
  returns the cursor to the category that owns the list. Selecting an
  entry only plays Select A until the player exists.

  Album rows carry their **cover art** in the 24 px icon box, in place of
  the neutral square — the only category that has any, as on the console.

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

Two highlight providers nest (`LibraryMenuProvider`): the outer follows
the category rows and picks the list, the inner follows the entries and
drives the counter, so hovering an entry never changes the category. The
list is keyed by category so a switch remounts it with the counter reset.

### 6.13 Pictures screen

Opened by the Media blade's Pictures row (`PicturesScreen.tsx`). Same
full-screen structure and Media blue as the Audiobooks screen (§6.12);
the header reads "Pictures", the legend is Y/X dimmed, Back B, Select A.

The body is a **3×3 grid** of square tiles, centred and bounded by the
slab's height so the nine tiles stay square at any viewport, with a 16 px
gap. Tiles wear the Achievements tile skin (§6.10): raised border and
bevel on white at 8%, the pale grey wash at 55% as the cursor. A filled
tile shows its picture edge to edge behind an 8 px inset with 6 px
corners. Slots past the end of the list show the striped placeholder
(§6.7) watermarked with the slot number, and stay cursor stops with
`aria-disabled` (like an `unavailable` row, §7.2) so the grid's D-pad
arithmetic holds; Select on them does nothing. A 24 px caption under the
grid names the highlighted picture.

Pictures are the user's own: files dropped into `public/assets/pictures/`
and listed in `pictures.ts` (file name and caption). The grid shows the
first nine. Selecting a picture only plays Select A until the viewer
exists. The grid is `data-nav-list="3"` (§8): Up/Down step a row,
Left/Right a column.

### 6.14 Album screen

Opened by an album row in the Audiobooks browse list
(`AlbumScreen.tsx`) — Media blade → Music → Audiobooks → here. Same
full-screen structure and Media blue as §6.12.

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

Screens stack four deep here: Media blade → Music (§6.11) → Audiobooks
(§6.12) → album (§6.14) → song (§6.15). Each is its own portal and Back
peels off one at a time (§5.4).

### 6.16 Music Player

Opened by Play Song on the song screen (§6.15) or Play Album on the album
screen (§6.14) — `MusicPlayerScreen.tsx`. Same full-screen structure and
Media blue as the rest of the chain, which now runs five deep: Media
blade → Music → Audiobooks → album → song → player.

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

**LB and RB cycle the visualizer** (`1` and `2` on the keyboard, §8), as
the console's did. There are four, all reading the same band array — so
switching costs nothing and needs no second analyser
(`visualizer-styles.ts`): the LED matrix, a pair of mirrored continuous
bars, which is what the console itself drew, a radial ring whose spokes
grow outward from the centre, and **Water**.

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
height, so flat water reads black and only the moving rings light up. The bumpers
are advertised by the hints in the panel's bottom corners rather than by
the legend, which is a four-slot grammar with no room for them (§6.5);
the current visualizer is named between them. They wrap, so there is no
end of the list to get stuck against.

All three fall back to a synthesised signal when no analyser is feeding
them, freeze when paused and under `prefers-reduced-motion`, and stop
asking for frames when still.

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

Back is only listened for while something is open, so it is silent when there
is nothing to go back from. Replaying a cue restarts it; different cues overlap.

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
