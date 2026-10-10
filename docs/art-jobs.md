# Art jobs: the card backs and the world

**Status:** decided 2026-10-10: the house style is **A, pixel diorama**
(AJ1), and daylight is **sky high, table low** (AJ2); AJ3–AJ6 as
recommended. **Job 0, the pixel renderer, is done** (`art/0`), and **Job 1,
the dungeon, is done** (`art/1`); logs below. Jobs 2–6 are next, one setting
at a time.

These are briefs for rebranding the art that sets each crossing's mood:
- **the card back** of each setting: the face-down cards in the river, the
  deck pile, and the doors on the threshold;
- **the world**: the WebGL layer behind the table (its ground, its air, the
  dark that closes in) and the vista above the river.

They are written to be executed in the atelier (`apps/atelier`) with
`packages/art`, the way every picture in the game is made now, and judged by
contact sheets and scripts before anyone's eyes. The front door's plan
([front-door.md](front-door.md)) shows this art wherever it lands, so these
jobs can ship one setting at a time.

The card faces are not in scope. They are the product, and the overhaul's
constraint stands: the face, its arch glyph and symbols, the canonical names
and the colour families do not change.

## The rules these jobs work inside

- **No art that is not ours (A7).** The six reference images are for mood,
  light, palette and composition, and nothing more. Nothing is traced,
  reproduced or sampled pixel for pixel, and the images are not stored in the
  repo. (Some look like stock or model-made pictures, and one carries an
  artist's mark: all the more reason to treat them as references and nothing
  else.) The palettes below were *measured* from them, as a starting point.
- **Generated and seeded** (W2): every picture is a function of a setting, a
  style, a seed and the palette, so it can be re-rolled, animated, and drawn
  at any size. AJ3 asks whether that should change.
- **The arch is on every back.** Every card is the same doorway; only what
  stands in it changes. The back is that doorway seen from the near side.
- **Category colours are reserved.** Each setting already lights its world
  with one card family's colour: gold (Clear Path) for the dungeon, tower and
  desert, teal (Obstacle) for the forest and the undercity, and blue
  (Wanderer) for the frozen pass. A setting may use its own light's family
  freely. Any *other* family's hue may appear only small (under about 5% of
  a picture), or a background starts saying what a card means.

  | Family | 500 | Lights |
  |---|---|---|
  | Clear Path | `#E3A445` | dungeon, tower, desert |
  | Obstacle | `#43917B` | deep forest, undercity |
  | Wanderer | `#6B8CA6` | frozen pass |
  | Item | `#8B4F9C` | — |
  | Monster | `#A93343` | — (the dark's own colour as threat rises) |
- **The table stays dark: the luminance budget.** Parchment text has to keep
  4.5:1 against whatever the world draws behind it. That puts a hard ceiling
  on the world's brightness behind the table:

  | Text over the world | Its luminance | The world behind it, at most |
  |---|---|---|
  | Titles (parchment-100) | 0.83 | 0.146, a grey of about 107/255 |
  | Body (parchment-200) | 0.70 | 0.116 (96/255) |
  | Captions (parchment-300) | 0.51 | 0.074 (77/255) |
  | Notes (parchment-400) | 0.28 | **0.023 (42/255)** |

  The caption band, the hand and the rail carry notes, so behind them the
  world stays at or under **0.023**. The sky above the vista and the card
  backs are not under the budget, because no text sits on them.
- **The budgets the overhaul set:** the world's frame budget does not grow
  (`measure-frames.cjs`), each baked back stays small (under ~40 KB of SVG),
  and reduced motion gets a still frame that still tells the scene.

## What the art is today

- **A card back** is a scene from `packages/art`, baked by
  `scripts/bake-art.cjs` in the `flat` style: layered silhouettes of the
  setting's terrain (pillars, stairs, trees, dunes, vaults, peaks), a sun or
  moon, a pool of light, and the arch over it. It is baked whole, and as sky,
  far and near layers that the board moves in depth when a card tilts (phase
  6). The threshold's doors are the same picture, faded.
- **The world** is one WebGL2 canvas (phase 3): a ground (the setting's ink,
  a breathing pool of its light, grain, a vignette), an air of particles
  (dust, motes, sand, drips, snow), and an edge that closes in as threat
  rises (eyes, guttering, roots, a sand wall, frost; phase 5). Its colours
  are the setting's tokens.
- **The vista** draws a scene for every card turned, from the same generator
  as the backs.
- **The atelier already has four styles:** flat, line, **pixel** ("coarse
  grid, ordered dither, hard edges") and engraving.

What the contact sheet shows (`node scripts/capture-atelier.cjs`):
- **Every setting is the same two colours:** blue-black ink and one light.
  The frozen pass and the dungeon differ in silhouette, not in palette.
- **There is no light source in the picture.** The light is a glow with
  nothing making it: no torch, candle, firefly, sun on sand, or mushroom.
- **There is nothing to look at but the skyline.** No props, no story: no
  chain, no shelf of books, no stair rail, no root.
- **The pixel style is the flat style on a grid.** It has the same
  silhouettes and palette, quantised, and no pixel-art craft: no ramps, no
  outlines, no clusters, no sprites.
- **Daylight settings are drawn as night.** The desert is umber in the dark,
  where its reference is a peach sunset.

## The references, read

Each was measured: eight colours by k-means over the whole image, with each
colour's share, and how much of the image is dark (luminance under 60/255)
or light (over 180/255).

| Setting | Reference | Key | Measured palette (darkest first) | Take | Leave |
|---|---|---|---|---|---|
| Dungeon | A painted vault: arches, two portcullises, hanging chains and rings, rats on the flagstones, a torch out of frame | Low (81% dark) | `#0D0907` `#1C1411` `#241D25` `#352215` `#362B30` `#553620` `#804C25` `#B97337` | Warm umber dark; one torch, off-frame, raking across stone; chains as verticals; the rat as the scene's life | The painted finish, the exact architecture |
| Tower | A pixel library: a spiral stair, bookshelves, candles in sconces, lancet windows with a moon, a cauldron's green glow | Mid (39% dark) | `#131620` `#262638` `#3A394E` `#3F4A66` `#835A68` `#6D759C` `#BF6C70` `#DDB59F` | Slate and lilac stone; many small warm lights climbing; moonlight through tall windows; the stair as the composition | The rose candle colour (it is the Monster family); the green (near Obstacle and Trap) |
| Deep forest | Pixel woods at night: tall trunks, mist, a meadow of fireflies | Low (88% dark) | `#04050C` `#070B14` `#0B121D` `#0E1C28` `#152A36` `#23404B` `#30606A` `#836D3A` | Teal-black depth; mist bands between trunk rows; hundreds of tiny warm lights at 1–2% of the image | — it fits the table almost as it is |
| Desert | A pixel desert at sunset: a huge cream sun, coral sky, rock spires, dithered dunes | High (61% light) | `#F47F64` `#FD9557` `#FAA170` `#F8AF54` `#F9B67F` `#FDCA72` `#FACB8A` `#FEFEDD` | The heat of it; the giant sun; spires as the setting's shapes; dither as the texture of sand | Its brightness behind the table (24× over budget) |
| Undercity | A painted cave mouth: roots, a cold shaft of light, glowing mushrooms | Low (91% dark) | `#030203` `#070109` `#0B0310` `#100B23` `#191936` `#272959` `#47518A` `#62A6D0` | Darkness lit only by what grows in it; a shaft from above; drips | The violet (it is the Item family); the cyan, which leans to the Wanderer's blue. Bioluminescence goes teal |
| Frozen pass | Pixel peaks under a blue sky, a snowfield, a dark rocky foreground | High (77% light) | `#2C5077` `#588FBC` `#84BDD8` `#A8E1F7` `#C8EAF6` `#E3F6FB` `#F0FAFC` `#FCFEFE` | Peaks with lit faces and shadowed faces; the dark foreground band (exactly the table band); cloud shapes | Its brightness behind the table (30× over budget) |

## The one hard question: daylight on a dark table

Four settings fit the dark table natively. The desert and the frozen pass
are daylight pictures, and their references are 24 and 30 times brighter
than the world may be behind the caption.

**Proposed rule: sky high, table low.** A daylight setting keeps its
daylight above the horizon: in the vista's sky, in the top of the world,
and on the card back. Below the horizon it falls through its own colours to
a ground that is under budget where the table sits. The frozen pass's own
reference already does this: its foreground is a dark band of rock. The
desert's ground goes from sunlit sand at the horizon to umber shadow at the
table, as if the party stood in the shadow of a spire.

The alternative (AJ2) is to set both at dusk, which keeps everything dark
and loses most of what makes the references sing.

## Three directions

Pick one as the house style (AJ1). The jobs below are written for A, with
what changes under B or C noted.

### A. Pixel diorama — recommended

**What it is.** True pixel art, generated: each setting is a little stage of
parallax layers at a low native resolution (a back at about 64 × 90 pixels,
a vista at about 240 × 100), drawn with a hand-tuned ramp of 12–16 colours,
ordered dithering for skies and fog, a one-pixel outline on near shapes, and
**sprites** for the life in it: fireflies that blink, candle flames that
flicker, drips that fall, a rat that crosses, snow, sand. It is scaled up by
whole numbers, nearest-neighbour, so every pixel stays crisp.

**From the references:** desert, deep forest, tower and frozen pass are pixel
art already. The dungeon and undercity bring their *lighting*: a single warm
or cold source raking through the dark, which pixel art does beautifully
with ramps and dither.

**Why A.**
- **It is the clearest change of identity.** The current backs are tasteful
  and anonymous; pixel dioramas are unmistakable.
- **It suits the engine.** Pixel layers are tiny textures, cheap to draw and
  to move, and sprite animation is a handful of frames. The world layer
  needs a texture pass added for them, and no new dependency.
- **It suits the game.** The deck is about doors and paths in a dungeon
  crawl. Pixel art carries that lineage without borrowing anyone's art.
- **It can be generated.** Ramps, dither, outlines and sprite stamps are
  rules, and rules are what `packages/art` is made of. The `pixel` style is
  the seed of it.

**The risk.** The card faces are engraved, serif and gold, and a pixel back
next to an engraved face could look like two products. The answer is the
**frame**: the back keeps the face's engraved border and gold arch drawn
crisp at full resolution, with the pixel diorama inside the arch, like a
window. The vista above the river, which draws each turned card's scene,
takes the same treatment, so the back and the scene a card turns into
belong together. The faces themselves keep their glyphs.

### B. Lantern-lit painting

**What it is.** Painterly chiaroscuro: one light source per scene, deep
shadow, brush texture, soft atmospheric depth. It is closest to the dungeon
and undercity references, and to today's dark brand.

**How it would be made.** A painterly pass in the world's ground shader
(strokes from domain-warped noise, oriented along the scene's forms), and
SVG backs with turbulence filters and layered glazes.

**The cost.** Painting is the hardest thing to generate well, and it is
easy to end with mud. It animates less naturally than pixels (a painted
flame flickers by distortion, not by frames). It would look the most
"premium" if it worked, and it is the least certain to work.

### C. Engraving and glow

**What it is.** The atelier's `engraving` style (hatched silhouettes, denser
as they come nearer, the deck's print heritage) with one luminous element
per setting in its light colour: fireflies, candle points, mushroom caps,
the sun's disc, a torch. Black and gold, with one glow.

**Why consider it.** It matches the card faces exactly, since they are
engraved too. It prints: the print deck could have the same backs, which A
and B cannot give it. It is the smallest step from today.

**The cost.** It is a refinement, not a rebrand. The daylight references
lose almost everything under it.

**C can also accompany A** as the print deck's backs: the same compositions,
engraved, since a pixel diorama does not print well at card size.

## The jobs

Written for direction A. Each job makes one setting's **back** (whole and
in sky, far and near layers, for tilt) and its **world** (the ground and air
retuned, the edge as threat rises, the vista's subjects). Job 0 comes first;
jobs 1–6 can go in any order; jobs 7–8 serve the front door and the print
deck.

### Job 0 — the pixel renderer (foundation)

Upgrade the `pixel` style in `packages/art` from "flat on a grid" to a pixel
artist's toolkit:
- **Ramps.** Each setting declares a 12–16-colour ramp. Every fill quantises
  to it, and light moves along the ramp, never off it.
- **Dither.** 4×4 Bayer for skies, fog and light falloff, with a per-layer
  strength. A ramp step plus dither is how a gradient is drawn.
- **Outlines.** A one-pixel outline on near layers, darker than what it
  edges and never black. Selective, so a lit edge goes lighter.
- **Sprites.** Small hand-specified sprites (a flame of three frames, a
  firefly of two, a drip, a rat of four, a snowflake, a mote), stamped by
  seed, each with its own frame timing.
- **Lights.** A point light colours the ramp step of everything near it and
  can flicker. That is how a torch rakes across stone without a gradient.
- **Output** as crisp SVG (`shape-rendering: crispEdges`, one rect per run of
  pixels) for the backs and doors, and as an image the world uploads as a
  texture for its layers.
- **The atelier gets a bench** for ramps, and a sprite sheet view.

**Done when:** every setting renders in the new pixel style in the atelier,
deterministic by seed; `bake-art.cjs pixel` writes the backs and their
layers; each back is under ~40 KB.

### Job 1 — Dungeon: *The keeper's vault*

**Done** (`art/1`, log below).

- **Reference:** the painted vault (chains, portcullises, rats).
- **Mood:** you are not the first through here, and something keeps the
  place.
- **Ramp, from the measure:** `#0D0907` `#1C1411` `#241D25` `#352215`
  `#553620` `#804C25` `#B97337`, plus a flame `#E8A452` and a core `#F6D58A`.
  The torch is in the dungeon's own light family (Clear Path gold), so it may
  be large.
- **Light:** one torch off-frame left, raking across the arches. It flickers
  on a slow irregular cycle and gutters as threat rises (the edge already
  gutters).
- **The back:** the arch frames a vaulted corridor receding to a lowered
  portcullis lit from behind; two chains hang in the near layer (they swing
  a pixel when the card tilts); a rat on the far flagstones.
- **The world:** the ground in umber, the pool of light as torchlight, dust
  in the air. As threat rises: the eyes between the pillars, and the torch
  dimming.
- **The vista's subjects:** a portcullis for an Obstacle; a lantern-bearer
  for a Wanderer; an open chest for an Item; a shape behind the bars for a
  Monster; the corridor opening for a Clear Path.
- **Watch:** keep the rust and blood-brown away from the Monster red.

### Job 2 — Tower: *The stair library*

- **Reference:** the pixel library (spiral stair, shelves, candles, moon,
  cauldron).
- **Mood:** everything climbs, and someone has been reading up here for a
  long time.
- **Ramp:** slate and lilac stone, `#131620` `#262638` `#3A394E` `#3F4A66`
  `#6D759C`, with moonlight `#C9D6EA`. The candles go **amber, not rose**
  (`#E3A445` → `#F2CB8A`): rose is the Monster family, amber is the tower's
  own light.
- **Light:** many small candles up the stair, each with its own flicker; a
  cold moon through two lancet windows; a cauldron's glow kept to a few
  pixels and pushed acid-yellow, away from the Obstacle teal.
- **The back:** the arch is a lancet window: through it the stair winds up
  past shelves, and candles climb with it to a moonlit top.
- **The world:** candle motes rising, the edge's guttering candles (it
  already has them), two pairs of eyes above.
- **Watch:** this is the busiest composition, so it must still read at `sm`.
  The stair and the window carry it; the shelves are texture.

### Job 3 — Deep forest: *Firefly hollow*

- **Reference:** the pixel woods at night.
- **Mood:** the forest is breathing, and it has been watching for a while.
- **Ramp:** taken almost directly, `#04050C` `#070B14` `#0B121D` `#0E1C28`
  `#152A36` `#23404B` `#30606A`, with the forest's own light, Obstacle teal
  (`#43917B` / `#7FC0AC`), for the mist and moonlight.
- **Light:** the fireflies, which are amber (`#F2CB8A`) and so in the Clear
  Path family. They are allowed because they are tiny, kept under 2% of any
  frame. They blink on their own cycles and drift; at one strike short
  (the hush) they go still.
- **The back:** the arch is two trunks leaning in; through it, a lit
  clearing under a band of mist and a scatter of fireflies.
- **The world:** mist in two bands between trunk rows, fireflies as the air,
  roots reaching in with the edge, and the eyes.
- **Watch:** nothing in the budget. This setting fits the table as the
  reference stands.

### Job 4 — Desert: *Salt and sunset*

- **Reference:** the pixel desert (giant sun, coral sky, spires, dunes).
- **Mood:** heat, distance, and nothing to hide behind.
- **Ramp:** the sky from the measure, `#FEFEDD` `#FDCA72` `#F9B67F` `#FD9557`
  `#F47F64`. The ground descends through `#B9733A` and `#6B3E22` to
  `#2A1810` and `#140B07`, under budget at the table.
- **Light:** the giant sun low on the horizon; heat shimmer as a few rows of
  pixels offset in the far layer; sand blowing across the near dunes.
- **The back:** the arch is cut through a spire; through it, the sun sitting
  on the dunes. This is the brightest back in the deck, and it is allowed to
  be: no text sits on a back.
- **The world:** sky high, table low. The sunset is the top fifth of the
  world, and the ground darkens to the shadow of a spire behind the table.
  The edge is the sand wall that already exists.
- **Watch:** the coral (`#F47F64`) leans towards the Monster family. Keep it
  to the sky's thin bands, never near the table.

### Job 5 — Undercity: *The glowing vaults*

- **Reference:** the painted cave mouth with glowing mushrooms.
- **Mood:** the city above forgot this place, and something grew in it.
- **Ramp:** the darks from the measure, `#030203` `#0B0310` `#100B23`
  `#191936` `#272959`, with the glow moved into the undercity's own light,
  Obstacle teal: `#235347` → `#43917B` → `#7FC0AC` → `#C8F0E2`. The
  reference's violet stays only as near-black indigo shadow (it is the Item
  family), and its cyan becomes teal (the cyan leans to the Wanderer's blue).
- **Light:** mushroom clusters glowing teal, pulsing slowly out of step; one
  cold shaft from a grate above; drips that catch the light as they fall.
- **The back:** the arch is the mouth of a brick vault; through it, a path
  between glowing mushroom clusters to a lit far opening.
- **The world:** drips as the air (they exist), the mushrooms' glow as the
  pool of light, many small low eyes with the edge.
- **Watch:** this is the clearest case of the reserved colours. A violet
  undercity would put the Item's colour behind every card.

### Job 6 — Frozen pass: *The white teeth*

- **Reference:** the pixel peaks under a blue sky.
- **Mood:** clean, enormous and indifferent, and very cold.
- **Ramp:** the sky and ice from the measure, `#FCFEFE` `#E3F6FB` `#C8EAF6`
  `#A8E1F7` `#84BDD8` `#588FBC` `#2C5077`, with the dark band `#162536`
  `#0B1520` `#060B11` for the near rock and the table. The light is the
  frozen pass's own, the Wanderer's blue, so the blues may be large.
- **Light:** sun on the peaks' lit faces; spindrift blown off a ridge; snow
  in the air. The moon variant (a night pass) is a re-roll of the same
  scene with the ramp darkened.
- **The back:** the arch is a gap between two near rocks; through it, the
  peaks in full light. The second-brightest back.
- **The world:** sky high, table low. Peaks in the top band, the near rock as
  the table band (as in the reference). The edge is the frost and the pale
  shapes that already exist.
- **Watch:** the budget. The rock band must cover the caption and hand
  rows at every viewport.

### Job 7 — The front door's walk

For the landing (front-door phase 1): one long panorama of the six settings
in sequence, dungeon → tower → forest → desert → undercity → pass, each
joined to the next at a doorway (the arch again). The landing pans slowly
along it. It is made of the jobs above, not a seventh style.

**Done when:** the panorama tiles without a seam at each join, and it pans at
the landing's frame budget.

### Job 8 — The print deck's backs (optional, with C)

The same six compositions in the engraving style, black and one metallic
ink, for the print deck (`scripts/print-deck.mjs`). A pixel diorama does not
survive at card size in print; an engraving does.

## How a job is judged

- **Contact sheets.** `capture-atelier.cjs` gains the new style and benches:
  every setting's back, layers and vista subjects in one folder.
- **The luminance budget, by script** (new): sample the world canvas behind
  the caption band, the hand and the rail at five viewports, and fail if any
  sample is over 0.023.
- **The colour reservation, by script** (new): the share of a back's and a
  world frame's pixels within a small distance of each category hue that is
  not the setting's own light. It fails over 5%.
- **The thumbnail test:** every back at `sm` (the river on a laptop) and at
  the threshold's door size, side by side. The arch and one recognisable
  subject must read.
- **The frame budget:** `measure-frames.cjs --gpu` against the commit
  before, alternating, in one session.
- **Reduced motion:** the still frame of each world tells its scene.
- **The author's eye,** last, on a real screen.

## Decisions for the author

| # | Question | Recommended |
|---|---|---|
| AJ1 | The house style: A (pixel diorama), B (lantern-lit painting) or C (engraving and glow)? | **Decided: A** (2026-10-10). C stays the route for the print deck. |
| AJ2 | Daylight settings: sky high and table low, or everything at dusk? | **Decided: sky high, table low** (2026-10-10). |
| AJ3 | Generated (as now), hand-made by an artist you commission, or from an image model? | **Decided as recommended: generated**, as W2 holds: seeded, animatable, at any size, and clearly ours. A commissioned artist could later hand-finish the six backs; that changes the overhaul's "no image assets" but not A7. Model-made images have unclear provenance, and several of the references look like them; this plan does not use them as assets. |
| AJ4 | Keep the category colours reserved, even where a reference wants violet or rose? | **Decided as recommended: yes.** A background that shares a card family's colour blurs what the cards mean, and that is the one thing the art must never do. |
| AJ5 | Do the backs move (fireflies blinking on a face-down card), or only the world? | **Decided as recommended: only the world, and the backs' depth on tilt.** A river of three animated backs pulls the eye from the faces, which are the point. |
| AJ6 | Does the vista (the scene drawn above the river for each card turned) take the pixel treatment too? | **Decided as recommended: yes**, setting by setting in jobs 1–6, each measured on a phone. The back and the scene a card turns into then look like one place. The card faces keep their glyphs, frames and words. |

## Log

### art/0 — the pixel renderer

**Changed.**
- **`packages/art/src/pixel.ts` (new): the pixel style, drawn as pixel art.**
  - Each setting's **look**: ramps for sky, land, light and rim, from this
    document's palettes, and what lives in its air.
  - A **sprite library**: mote, dust, snow, sand, drip, firefly (three
    frames), flame (three) and rat (two), each a few hand-placed pixels,
    with frame rates for whoever animates them.
  - **`rasterize()`** draws the existing scene model on a grid, which stays
    the one description of a picture:
    - the sky steps down its ramp with a 4 × 4 ordered dither;
    - the light is dithered rings of its own ramp, from the sun or moon
      where the setting has one;
    - the land takes its ramp by depth, and near land catches a rim along
      its top edge;
    - the card's subject stands in front, with a dithered halo;
    - the air's sprites are stamped by seed.
  - It also draws **one depth alone** (sky, far, near) for backs that tilt,
    and gives RGBA bytes (`toRgba`) for the world to use as a texture
    later.
- **`packages/art/src/png.ts` (new): a PNG encoder in plain TypeScript.**
  Indexed colour, one transparent entry, stored deflate blocks, and its own
  CRC, Adler and base64. A picture's bytes are the same everywhere.
- **`scene.tsx`'s pixel style is the new rasteriser**, drawn as an indexed
  PNG inside the SVG with `image-rendering: pixelated`. A back is lit by its
  setting's light; a card's scene by the card's colour, as the other styles
  light it. Pixel pictures now draw parts, like flat ones.
- **The atelier has a Pixel bench.** It shows the setting's ramps, every
  sprite with its frames, animated, and the back at its true size, at three
  times, and as its three layers on a checkerboard, with its size. The Back
  bench offers layers for pixel too.
- **`bake-art.cjs pixel`** bakes every back whole and in layers. The old
  grounds (the world's *Off* picture) are baked only in the flat style.
- **Every card back in the game is pixel art now:** all 24 files (six
  backs, each with three layers) rebaked, in the river, on the deck and on
  the threshold's doors.
- **`capture-atelier.cjs`** photographs every setting's pixel back and its
  Pixel bench.
- **Tests:** nine in `packages/art/test/pixel.test.ts`, the package's
  first. The PNG is decoded back with Node's zlib and matched byte for
  byte, and base64 matches Node's. A picture is the same for the same seed,
  and each setting draws only from its own ramps and sprites. The fade
  changes the palette and not the pixels; layers are opaque or clear as
  they should be; a back stays under 40 KB; a scene takes the card's
  light.

**Design notes.**
- **An indexed PNG, not a rect per run.** The old pixel style wrote one SVG
  rectangle per run of pixels. Dither makes runs short, and at back size
  that is hundreds of kilobytes. A 96 × 134 back with 8–11 colours is 17.1 KB
  as a data URI, smaller than the flat backs it replaced (24–25 KB).
- **The fade is mixed into the palette,** so a faded back is the same
  pixels in sunk colours, and a layer's transparency stays clean.
- **A light in the picture comes from something.** Where a setting has a
  sun or moon, the light's rings centre on it. Otherwise the light keeps
  its place in the scene.
- **The vista keeps the flat style for now.** A vista is drawn live on
  every reveal, and a wide one in pixel is tens of thousands of pixels. It
  moves to pixel in jobs 1–6, one setting at a time, each measured on a
  phone (AJ6).

**Broke / retried.**
- **The desert and the pass had two suns:** the setting's light at the top
  and the disc beside it. The light now comes from the disc.
- **`Ramp` was already a type in `biomes.ts`**; the pixel one is
  `PixelRamp`.
- **A shell heredoc ate an apostrophe** in the atelier's bench list, as my
  notes warn they do. Fixed with an edit.

**Verified.**
- **The Pixel bench, every setting:** 96 × 134 pixels, 8–11 colours, 17.1 KB
  each, no page errors.
- **The bake:** 24 files at 17 KB each; the grounds untouched.
- **In the game:** the river's backs, the deck and the doors are pixel art.
  The tilt still moves the layers in depth (`capture-weight.cjs`), and a
  full crossing reveals 10 cards over 118 samples at **0px**.
- **The contact sheet:** 47 shots, no errors. Card scenes in pixel take each
  card's colour inside the arch.
- **Tests and build:** art tests 9 (new), app tests 41, and the table and the
  atelier typecheck. The build is clean, and the bundle grew 2.1 KB gzipped.

**Not yet.** What only jobs 1–6 add: each setting's props (chains, candles,
mushrooms, spires), its light sources in the picture, its vista in pixel,
and its world retuned to the ramps. The world's texture path (`toRgba`) is
ready, and nothing uses it yet.

**Commit:** `git log --grep art/0`.

### art/1 — the dungeon: *The keeper's vault*

**Changed.**
- **The vault, in `scene.tsx`.** The dungeon has its own composition now, in
  every frame and style: doorway after doorway across the whole picture,
  each nearer and wider, down to a lowered portcullis lit from behind.
  - Each wall is **one polygon** with its arches cut down to the floor, so
    every style can draw it and the walls sort by depth. On a back, the
    layers part down the corridor when the card tilts.
  - Every opening has its **thickness**: the right side catches the torch,
    the left side stays in shadow. That is what makes the arches read as
    stone, not cut-outs.
  - **A torch off the frame to the left** rakes across the near arches.
    **Two chains** hang black in the near layer, a **rat** keeps to the
    flagstones, and dust hangs in the air.
  - **On a wide vista the nearest wall is an arcade.** A torch burns in
    every third bay out from the middle (a flame sprite and its own light),
    and the courses of the stone run between them.
  - **The dungeon's subjects:**
    - an Obstacle is a portcullis down across the way;
    - a Wanderer is someone with a lantern, coming the other way;
    - an Item is an open chest, something in it catching the light;
    - a Monster is a shape behind bars, its eyes the card's red;
    - a Clear Path is the corridor opening, as the back is.
- **The rasteriser learned what the vault needed** (`pixel.ts`). Each of these
  is opt-in, so the other five settings draw exactly as before:
  - **more lights than one**, each keeping the setting's colour (`own`) where
    a scene is otherwise lit by the card;
  - **lit stone** (`landLight`): a light lifts the land it falls on up the
    ramp and on into the light's warm middle. A tone sits in the middle of
    its ramp step, so unlit stone is one flat colour, not a dither;
  - a layer's **tone** (where it sits on the land ramp), separate from its
    depth (which layer of a back it moves with);
  - **silhouettes** (`shadow`) that no light lifts: the bars, the chains, the
    joints of the floor;
  - **stone courses**: each joint drawn a step darker, wherever it is lit;
  - **stamps**: sprites the composition places (the rat, the flames).
- **The rasteriser fills shapes a row at a time.** It works out where each
  row crosses a polygon once, then sweeps the row, where it used to test
  every polygon at every pixel. It is the same even-odd rule and the same
  arithmetic, and a test holds it to the old per-pixel test, pixel by pixel.
  A desktop vista went from 165–200 ms to 6 ms, a phone's from 40 ms to 5 ms.
- **The world draws as pixel art** where a setting has a `world` in its look
  (only the dungeon so far). Its canvas is a quarter of the size, scaled up
  crisp.
  - Every colour snaps to the dungeon's ramp through the same 4 × 4 dither
    as the backs, with a small spread, so flat ground stays one colour.
  - The ink is umber, and the pool is torchlight: it **flickers** on two
    noises, quick and slow, and **burns lower** as threat rises (the old
    guttering stays).
  - **Pillars** stand at either side of a wide screen, round stone lit on
    the side toward the light. **The eyes look out from between them**, and
    are hidden where a pillar stands.
  - In pixel art an eye is a red slit edged in darker red: a faint pink
    glow snapped to the torch's orange, and read as a lamp.
  - A turned card's colour washes out as a dither of its own, since the
    ramp would swallow a faint tint.
  - Dust is whole pixels, there or not, in the ramp's two dust colours.
  - The other settings' worlds are unchanged.
- **The vista is pixel art in the dungeon** (AJ6), three scene units a
  pixel, the same size on screen as the world's pixels.
- **The dungeon's back, rebaked:** 96 × 134 pixels, 9 colours, 17.8 KB.
  It shows in the river, on the deck and on the threshold's door.
- **`check-art.cjs` (new): the art judged by numbers.**
  - **The luminance budget.** Everything but the world is hidden and the
    screen is read in 12 px blocks behind the caption band, the hand, the
    rail, the top bar and the ticker, at five sizes.
  - **The colour reservation** of the back and of each world frame.
  - **A thumbnail sheet** of every back at the river's size and at a small
    size, side by side.
- **`capture-walk.cjs` no longer measures a card on its way to the
  discard.** A Monster leaves the river 1.14 s after it turns, inside the
  1.6 s the reveal is sampled. This walk was the first to turn one, and
  reported its trip as 596 px off its slot.

**Design notes.**
- **The world's pixel art is made in its shader, not uploaded as an
  image.** The ground moves all the time (the fog, the flicker, the dark
  drawing in), and snapping it to the ramp is one pass over a sixteenth of
  the pixels. The texture path from Job 0 (`toRgba`) is still unused.
- **The arcade lights one bay in three.** A torch in every bay, across a
  vista six times wider than tall, was a row of identical lamps and read as
  a pattern rather than a place.
- **The pillars appear only on screens wider than 1.2 : 1.** On a phone the
  sides are the table, and a column there would only be clutter.
- **Monster red stays off the dungeon's stone.** The ramp is umber and
  rust, kept under 60° of hue, and the reds in the world's ramp are the
  dark's own colours, used only for the eyes. At one strike, the reservation
  still finds 0.0% Monster red in the world frame.

**Broke / retried.**
- **The first world was a checker of purple and brown** over the whole
  table. The dither's spread was larger than the gap between the ramp's dark
  steps, and the ramp's cool dark (`#241D25`) read violet. The world's ramp
  is umber only now, and its spread is 0.025.
- **The first pillars were thin bright lines**, which read as part of the
  interface. They are rounded stone now, shaded across their width.
- **The first stone was washed out.** A lit grey covered the near walls, and
  the arches had no edges. Thickness on the openings, flat tones and a
  smaller torch fixed it.
- **The vista skipped its stone courses:** at three units a pixel they were
  under the three-pixel minimum. Courses are now at least three pixels high
  on the nearest wall.
- **The pixel vista first cost a phone a 430–480 ms frame** on every reveal
  (against 150–270 ms before). It was the per-pixel polygon test. With the
  row-at-a-time fill, the turn measures level with the commit before.
- **A long heredoc failed again in Git Bash**, as my notes warn. The edits
  went in through files.

**Verified.**
- **The bake:** only the dungeon's four files changed. The other 20 backs
  and the 6 grounds are byte-identical. After the row-at-a-time fill, all
  30 files rebaked byte-identical, which shows the fill draws exactly the
  pixels the old test did.
- **`check-art.cjs`, at 1600 × 1000, 1366 × 768, 1920 × 1080, 768 × 1024
  and 390 × 844, on the GPU:**
  - every block behind the words is within budget; the worst behind the
    caption is 0.0196 against 0.023;
  - the back is 13.1% the dungeon's own gold and 0.0% every other family;
  - each world frame is 3.2–12.1% its own gold and 0.0% every other family,
    at no strike and at one.
- **The frame budget** (`measure-frames.cjs --gpu`, a phone at 4× CPU),
  alternating against `art/0` served from a worktree in the same session:
  - idle is 0.24–0.25 s per 4 s against 0.24, and 0.23–0.27 s at one
    strike against 0.23–0.24;
  - one turn is 1.37–1.54 s against 1.31–1.50 s, and its worst frame
    117–167 ms against 117–183 ms.
- **Walks:**
  - a full crossing at 390 × 844 revealed 11 cards over 102 samples, and one
    at 1600 × 1000 revealed 14 over 182, both at **0px**, with no errors;
  - the dark and being found, staged (`capture-score.cjs`), show the eyes
    as slits between the pillars;
  - under reduced motion the still world shows the arcade, the pillars and a
    pair of eyes;
  - the tilt still parts a back's layers (`capture-weight.cjs`).
- **The atelier's contact sheet:** no errors. The vault draws in the line
  and engraving styles too.
- **Tests and build:**
  - art tests 19, ten of them new: the fill against the per-pixel test at
    four pixel sizes, lit stone, silhouettes, courses, a lamp keeping its
    colour, stamps, the back's torch and rat and chains, the arcade's
    flames, a vista's time, and the world's ramp;
  - app tests 41, rules 74, and the table and the atelier typecheck;
  - the build is clean; the bundle grew 3.8 KB gzipped (139.8 → 143.6 KB).

**Not yet.**
- **The chains do not swing on their own.** They move with the near layer
  when a card tilts, as all of it does. A one-pixel swing would need its own
  layer.
- **Not seen on a real screen:** the torch's flicker, and how the dither
  holds up at a real display's density, are for the author's eye.

**Commit:** `git log --grep art/1`.
