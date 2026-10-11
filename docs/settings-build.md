# Building the settings: fourteen places, inside and outside

**Status:** started 2026-10-11, on the author's word ("Implement!") after the
designs in [art-directions/](art-directions/README.md) were drawn and shown.
No verdicts were saved on the review page, so every design on it is taken
as approved as drawn. Work is on the `front-door` branch, one commit per
phase (`set/N`).

## What is being built

- **The six settings the game has, redrawn**, each with the sides the author
  chose (AJ7): the dungeon and the tower inside only; the deep forest, the
  desert, the undercity and the frozen pass inside and outside.
- **Eight new settings** (AJ8, [new-settings.md](new-settings.md)): the
  King's Road and the Mire (outside), the Underdark (inside), and the High
  Road, the Drowned Coast, the Barrow Moor, the Ember Hold and the Sunken
  Jungle (both sides). That is 23 sides in all.
- **A side for every crossing:** inside or outside, chosen at setup, carried
  to every device. The deck's back, the vista and the world all follow it.

## Decisions taken to start (the author can overturn any)

| # | Decision | Why |
|---|---|---|
| S1 | **The deck shows the back of the side being played.** | The review page asked; no answer was saved. A side is chosen per crossing, so its back matching it is the consistent reading. |
| S2 | **A crossing's default side is the outside where a setting has one.** The threshold remembers the last choice per setting. | One rule; the outsides were the first-picked designs for the forest and the desert. |
| S3 | **The designs move into `packages/art`** as the one source: the painter (`paint/px.js`) and one module per setting (`paint/settings/<id>.js`). The review page is built from them. | Two copies would drift. |
| S4 | **Each setting's art loads only when it is played** (a dynamic import per setting). | All fourteen are ~14,000 lines; the game should not ship them all up front. |
| S5 | **Backs are baked as PNGs** by a Node script, one per side, and **tilt as a whole card**. The new backs have no inner parallax layers. | A painted pixel hides what is behind it, so a design cannot be split into clean depth layers without a hole or a ghost when they move. The card's own tilt, sheen and weight stay. |
| S6 | **The vista is the design, drawn live on a canvas,** a few frames a second, crossfading on each card as now. | Each vista builds in under 30 ms and animates its own light. |
| S7 | **The world is the design, resolved on the GPU.** The painter's per-pixel ramps, values and light fields upload once as textures; each frame sends only the lights' strengths, and the shader snaps to the ramp exactly as the painter does. The mood (threat, the dark's edge, dim, bloom, the flash) works in the same value space, so it steps down the ramp, staying pixel art. Sprites and particles are drawn by the design on the CPU into an overlay. | Worlds carry up to 26 flickering lights. Per frame on the CPU that is too much for a phone; on the GPU it is nothing. |
| S8 | **"Off" shows the world's still frame as a picture** (a baked PNG per side), replacing the old animated SVG grounds. | It costs nothing while it is up, and it is the same place. |

## Phases

### 0. The painter in the package
Move `px.js` and the scene files into `packages/art/src/paint/` as ES
modules with a typed API: `designFor(setting, side)` (async, per-setting
chunk). Tests:
- a design is the same for the same seed;
- every world keeps the luminance budget at four moments;
- vistas build in time;
- every setting and side has a back, a vista and a world.

The review page builds from the package.

### 1. Sides, and the backs
- `side` on the run (RunConfig, ViewRules), the campaign (remembered per
  setting) and the hosted room.
- The threshold's toggle.
- The GM drawer's preview.
- The deck skin keyed by setting and side.
- `bake-backs.mjs` writes `back-<setting>-<side>.png`; the river, the deck,
  the piles, the opening and the doors show them.

### 2. The vista
`PixelVista` draws the design for the box's aspect, animates while on screen
(never under reduced motion), crossfades per card and steps on ground
gained. The board, the phone, the storyboard and the route all use it.

### 3. The world
The GPU renderer (S7), the tiers (high, low, still), the off picture (S8),
and the frame budget measured against the commit before.

### 4. The eight new settings
- Their words: name, flavour, the seven cards' names and rules, and 31
  narration lines each.
- Their palette tokens.
- Their sound beds.
- How the dark comes in each.
- Fourteen doors on the threshold.

### 5. Verification, retirement and records
- Walks across the settings and sides, `check-art.cjs`, the phone, and
  reduced motion.
- Retire the old scene generator from the game: it stays for the atelier
  and the print deck.
- Update STATUS and DECISIONS.

## Log

### set/0: the painter in the package

**Changed.**
- **The painter and the 14 settings' designs moved** from the review folder
  into `packages/art/src/paint/` as ES modules: `px.js` and
  `settings/<id>.js`. The review page and its scripts now build from them,
  through `scripts/lib/paint.mjs` (the package bundled with the table's
  esbuild).
- **`paint/index.ts` is the typed way in:**
  - `SIDES` (the default side first) and `sideOf`;
  - `designFor(setting, side)`, one dynamic import per setting, so the game
    loads only the setting it plays;
  - `vistaOf` for every card.
- **Every card has a vista.** A Dead End and a Trap, which the designs were
  never drawn for, show the way blocked, with the Obstacle's ramp and light
  swapped for their own grey and acid green. Before any card is turned the
  vista shows the place with nothing in it.
- **Nine designs drew their Clear Path for any card they did not know.**
  Those chains now name the Clear Path. Otherwise the vista at rest would
  show the way open, which the author ruled out on the backs.
- `allowJs` (with `checkJs` off) in the table's and the atelier's
  tsconfig, so TypeScript reads the designs' JavaScript.

**Verified.**
- **Six new tests** in `packages/art/test/paint.test.ts`:
  - every side of every setting has its design, and none is set aside;
  - a setting falls back to its default side;
  - pictures are the same for the same moment;
  - all 23 worlds keep the luminance budget behind the caption, the river
    and the hand at four moments;
  - every card (and none) draws;
  - a Dead End and a Trap carry no teal.
- **The at-rest vistas** of all 23 sides, on one contact sheet.
- **Tests and build:** art 15, app 41, rules 74. Both apps typecheck, and
  the app's bundle is unchanged (nothing in the game loads a setting yet).

**Commit:** `git log --grep set/0`.

### set/1: sides, and the backs

**Changed.**
- **A crossing has a side.**
  - `RunConfig.side` is optional and inert, like the biome. `ViewRules.side`
    lets it through to every viewer, so a hosted room carries it to every
    phone; it rides in the room's existing state JSON, so the database needs
    no migration.
  - The campaign remembers the side per setting (`sides`); a setting with
    none plays its default.
  - `sideFor` and `sidesOf` read `SIDES` from the art package.
- **The setup screen asks which side.** A two-sided setting shows *Outside*
  and *Inside* beside its flavour line. A one-sided setting says *Inside
  only* or *Outside only*. Each door shows its setting's back for the side
  last chosen.
- **The deck wears the side's back.**
  - Each setting file names its sides' art: the back and the world's still
    frame, baked by `scripts/bake-backs.mjs` from the designs as RGB PNGs.
    Backs are 3 to 6 KB, against 17.8 KB for the old SVG backs.
  - `skinOf(biome, side)` keys its cache by both.
  - The river, the deck, the piles, the opening and the doors show the side's
    back, scaled up crisp (`image-rendering: pixelated`).
- **The old SVG backs and their depth layers are gone** (S5): 24 files.
- `scripts/bake-backs.mjs` also bakes all 23 sides' still frames for the
  world's *Off* setting, and the eight new settings' art, for later phases.

**Not yet.** The vista and the world are still the old pictures, until
set/2 and set/3. The GM drawer's preview switch shows another setting at its
default side. The hosted room needs the Vercel function redeployed before a
phone sees the side; until then it plays the default side.

**Verified.**
- On the setup screen, picking the desert's *Inside* stores
  `sides: {desert: 'inside'}`, and the dungeon says *Inside only*.
- Starting the crossing carries `side: 'inside'` into the run, and the board
  wears the desert's inside back in the river and on the deck, with no page
  errors.
- A frozen pass walk revealed 13 cards over 201 samples at **0px**.
- **Tests:** rules 75 (one new: the side reaches every viewer, only when
  chosen, and never changes the deal), app 41, art 15; the table and the
  atelier typecheck.

**Commit:** `git log --grep set/1`.

### set/2: the vista

**Changed.**
- **The painter redraws only what its lights touch.** `prepare()` works
  out once which pixels any light or tint reaches and resolves the rest
  for good; each frame after copies those and redraws the lit ones.
  `resolveReference` keeps the old way, for the test.
  - A vista frame at the board's widest (432 by 72) now costs at most
    1.0 ms in Node, against up to 2.0 ms working out every pixel.
  - `node scripts/bench-vista.mjs [width]` measures every side.
- **The vista is the side's design, on a canvas** (`components/Vista.tsx`).
  - Each design pixel is a whole number of device pixels, so the dither
    stays even. The picture is about 72 of its own pixels high, as drawn,
    and is centred in the box. Its size rounds to 8 by 4, and is
    re-measured only once a resize settles, so dragging a window does
    not rebuild it per frame.
  - Its light moves at 8 frames a second while it is on screen and the
    page is showing. It holds one frame under reduced motion and when
    the world is set to *Still* or *Off*.
  - A new card fades in over the last, as before; a new size alone cuts.
    Ground gained still steps the picture forward.
- **A card never waits for its picture.** Building a vista costs 8 to
  40 ms, so the vista builds the cards not yet turned while the page is
  idle. Built pictures are kept per size and card
  (`components/pixel.ts`), about one size's worth.
- **The route's landmarks and the storyboard's scenes** are stills from
  the same design: the Clear Path's doorway, cropped, and each scene's
  card as the vista drew it.
- **The side reaches every screen:** the board, the phone, the route and
  the storyboard are given it.
- `capture-walk.cjs` takes `--side`.

**A change the author should know of.** The old vista drew a different
picture for every line of narration (seeded by the entry). The approved
designs draw one composition per card, so every Monster in a side is the
same picture, and every landmark on the route is the same doorway. Each
design could take a seed for small variations (where the props stand,
which way the light falls) if the author wants the variety back.

**Verified.**
- **The fast redraw gives the same bytes** as working out every pixel,
  for every side's back, world and three vistas, at two moments each
  (a new test).
- **A desert inside walk:** the tomb with its light shafts across the
  board and the Obstacle in the doorway, crisp; 4 reveals at **0px**; the
  ending's storyboard draws all three scenes; the route's landmark reads
  as the lit doorway.
- **A hosted frozen pass game:** the board and the phone (390 by 844 at
  2x, 2 CSS pixels to a design pixel) show the same vista, and every
  check in `capture-phone.cjs` passed.
- **It moves and holds** in a probe at 1600 by 1000:
  - with the world on *Auto*, 4 different frames in 4 samples;
  - under reduced motion, or with the world on *Still* or *Off*, one;
  - the canvas is 528 by 84, shown at 1584 by 252;
  - no page errors.
- **Frame budget**, at 390 by 844, 4x CPU, against set/1 served from a
  worktree and measured alternately:
  - at rest, 0.10 to 0.12 s of main thread per 4 s, against 0.08 to 0.09 s;
  - a turn, 0.80 to 0.99 s, against 0.84 to 1.04 s, so no change;
  - the worst frame is 100 ms in both.
- **Build:** each setting is its own chunk, 13 to 22 KB gzipped; the game
  no longer imports the old scene generator's pictures.
- **Tests:** art 16, app 41, rules 75; both apps typecheck.

**Commit:** `git log --grep set/2`.
