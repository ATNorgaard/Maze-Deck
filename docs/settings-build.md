# Building the settings: fourteen places, inside and outside

**Status:** built and shipped 2026-10-11 (`set/0`–`set/6`, live as `70cdeae`); the decisions
are DECISIONS S1–S13. Started the same day, on the author's word ("Implement!") after the
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
| S7 | **The world is the design, drawn in a worker; the GPU adds the mood.** *(Revised in set/3.)* The design works out its own picture about 12 times a second in a Web Worker, exactly as approved, sprites and haze included. The GPU lays the mood over it at the design's size, as the painter blends a coloured light: in dithered fifths per design pixel. The mood covers threat, the dark's edge, the eyes, dim, bloom and the flash. The GPU then scales the picture to cover the screen. | Planned as a GPU resolve of the painter. But some designs' overlays shift rows of the finished picture (heat haze), which a GPU overlay cannot reproduce, and once the painter redraws only lit pixels a frame costs under 2 ms. On the main thread that still cost a mid phone 0.2 to 0.35 s per 4 s, so it runs in a worker. |
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

### set/3: the world

**Changed.**
- **The world is the side's design** (S7, revised).
  - It is built at the viewport's shape, 200 of its own pixels on the
    short side, so a phone held upright gets a tall world.
  - A Web Worker (`world/paint.worker.ts`) draws its picture 12 times a
    second (8 on the *Light* tier): the lit pixels, then the design's
    sprites, particles and haze. The page uploads each picture as it
    comes.
  - The GPU (`world/renderer.ts`) makes two passes:
    - the **mood**, at the design's size, as the painter blends a
      coloured light (dithered fifths per design pixel);
    - the **screen**, the result scaled up nearest-neighbour to cover
      the viewport, nudged a few device pixels by the pointer.
- **The mood, in pixel art.**
  - A card's colour washes out from the river.
  - From the first strike the dark closes in, in ragged tendrils,
    reddening as it comes.
  - The setting's idiom at the edge: frost, a sand wall, or eyes, which
    are now a pixel each and blink.
  - In the dungeon and the tower, the design's own flickering lights
    gutter as the dark comes.
  - One strike short of being found, the design's clock slows.
  - Lost, the light goes out; through, gold rises.
  - Nothing of the dark shows at rest: the approved designs are the
    world as drawn.
- **Words stay readable** (new). The screen names where its words are,
  with the same budgets `check-art.cjs` reads (`BOARD_WORDS`,
  `PHONE_WORDS`). Behind them, a design pixel brighter than the budget
  steps towards the dark a fifth at a time until it is under. Only the
  bright details passing behind words change (the dungeon's chain
  behind the run's title, its torches behind a phone's tall top bar);
  the dark that is most of every world is left alone.
- **Off is the side's still frame** (S8), baked by `bake-backs.mjs`,
  crisp and held still. It also shows while the world loads. The old
  SVG grounds (six) and the page's slow drift are gone.
- **The vista now moves at 12 frames a second**, as the review page
  drew the designs, to match the world.
- `@maze-deck/art/paint` is the painter alone, for the worker, and
  workers build as ES modules so each setting stays its own chunk.
- `check-art.cjs` reads the PNG backs, takes `--side`, and logs where
  each region of words is. `node scripts/bench-world.mjs [WxH,...]`
  measures every side's world frame.

**Gone, for the author to know.** The old world's light no longer leans
towards the part of the table the phase is about, and its pool no longer
widens with ground gained. Either would lift the picture behind the
river and the caption, which the budget forbids, and the approved
designs already light themselves. *The author kept it so (2026-10-11,
S13).*

**Found, for the author.** The deep forest's outside back has 6.6% of
its pixels near the Wanderer's blue, over the 5% colour reservation in
`check-art.cjs`. It is its night sky, approved as drawn, so it is left
for the author to rule on. The *Off* still is baked without the words'
budget, so a bright detail behind the top bar there is as drawn.

**Verified.**
- **A dungeon walk on the GPU:**
  - the wall, its torches and the gate behind the table, crisp, with
    the vista's gate in line with the world's;
  - 3 reveals at **0px**;
  - the run closed, the world dims in steps.
- **Staged moments** (`capture-score.cjs`):
  - at one strike the edges darken in ragged dithered steps, with eyes
    a pixel each at the sides;
  - found, the edge reddens.
- **A deep forest walk with the world in the worker:** the root tunnel
  with its glowing mushrooms; 3 reveals at **0px**.
- **The luminance budget** (`check-art.cjs`), every region within it:
  - the dungeon at 1600x1000, 1366x768, 1920x1080, 768x1024 and
    390x844;
  - the deep forest at 1600x1000 and 390x844.
  - Before the words' budget, the top bar failed at every size and the
    caption at 768x1024 by 0.0001.
- **Every setting of the world, in a probe:**
  - *Auto* draws at *Full* on the GPU, and falls to *Still* on software
    GL;
  - reduced motion and *Still* draw one frame;
  - *Off* shows `world-desert-inside.png`;
  - no page errors;
  - the production build draws from its worker, on both GPUs.
- **Frame budget** at 390x844, 4x CPU, GPU, *Full*, against set/2 served
  from a worktree and measured alternately:
  - at rest, 0.23 s of main thread per 4 s against 0.18 to 0.20 s;
  - a turn, 0.91 to 1.24 s against 0.87 to 1.19 s, within noise;
  - the worst frame is 100 ms in both.
  - With the design drawn on the main thread, as first built, at rest
    was 0.41 to 0.55 s and a turn 1.31 to 1.56 s; hence the worker.
- **Build:** the worker is a 2.6 KB module with its own setting chunks.
- **Tests:** app 41, art 16, rules 75; both apps typecheck.

**Commit:** `git log --grep set/3`.

### set/4: the eight new settings

**Changed.**
- **Eight new settings to play**, each a file in `apps/table/src/biomes/`:
  the King's Road, the Mire, the High Road, the Drowned Coast, the
  Barrow Moor, the Ember Hold, the Underdark and the Sunken Jungle. Each
  one has:
  - **its words**, written for its place and fitting both its sides:
    - a name and a flavour line;
    - the seven cards' names, their rules reworded to say exactly what
      the card does;
    - 31 lines of narration: six Obstacles with every check among them
      (two at +1), six each of Clear Path, Wanderer and Item, three
      Monsters, and two each of Dead End and Trap;
  - **its light** (AJ4): gold for the King's Road, the Drowned Coast,
    the Ember Hold and the Sunken Jungle; teal for the Mire; blue for
    the High Road, the Barrow Moor and the Underdark;
  - **its palette** in `biomes.css`, cast to its place and tuned within
    the card families (the Ember Hold's metal never red, the Sunken
    Jungle's greens olive);
  - **its dark** (`World.tsx`), from new-settings.md:
    - wolves' eyes either side of the King's Road;
    - wisps low over the Mire's water;
    - rain driving across the High Road, and a giant's eyes on the
      ridge;
    - drowned lights coming in on the tide;
    - ghost-lights and mist over the Barrow Moor;
    - haze and embers closing in on the Ember Hold;
    - the Underdark's clusters of small eyes, and its fungus light
      guttering;
    - the Sunken Jungle's vines reaching in, with eyes in the leaves;
  - **its sound bed** (`bed.ts`). A new layer, thunder, gives the High
    Road its storm.
- **A setting's light is its own** (`Biome.light`); the world no longer
  asks the old scene generator for it.
- **Fourteen doors on the threshold.** They scroll with arrows, as the
  front door already allowed.
- **The still frame is veiled** (88% of the setting's ink) on every
  screen it shows on: the threshold, the landing, and the board when the
  world is *Off*. Unveiled, a still put the Ember Hold's molten metal
  straight behind the campaign's details and buttons. A still cannot
  know where words are, as the live world does, and at 88% even
  white-hot metal stays within the 0.023 budget. *Off* is now a dim
  ghost of the place.
- **A test holds every setting to the same shape**
  (`biomes/biomes.test.ts`):
  - art for exactly its sides;
  - a light of gold, teal or blue;
  - every rule still saying what its card does;
  - full narration with unique ids and every check.
- The scripts know all fourteen: `measure-frames.cjs`,
  `capture-sound.cjs`, and `check-art.cjs`'s `OWN`.

**Found, for the author.** The Drowned Coast's outside is gold against
storm blue, as new-settings.md planned it, and the colour reservation
counts the storm as the Wanderer's blue: 7.6% of the back and 11 to 12.5%
of the world, over the 5% line. Either the sea is made greyer, or the
rule allows a setting a second family as weather. Left as approved.

**Verified.**
- **The art** (`check-art.cjs`, GPU) of all 13 new sides at 1600x1000
  and 390x844:
  - every region of words is within its budget;
  - every back and world keeps the colour reservation but the Drowned
    Coast's outside.
- **The threshold** at 1600x1000 and 390x844:
  - fourteen doors;
  - picking the Ember Hold's *Inside* stores
    `sides: {'ember-hold': 'inside'}`;
  - the Underdark says *Inside only*;
  - no page errors;
  - with the veil, the campaign's details read clearly over the forge.
- **Walks on the GPU**, each with reveals at **0px**:
  - the Ember Hold inside: the forge hall, its Smith in the vista;
  - the Underdark: the fungus forest, the Many-Legs at the bridge, and
    at one strike its small eyes at the edges.
- **The sound** (`capture-sound.cjs`): all 52 checks pass.
  - Every new bed is audible, under the voices, and never clips.
  - No two of the fourteen are alike; the closest pair, the tower and
    the King's Road, differ by 0.24 against a floor of 0.2.
  - Getting there took three changes. The High Road first sounded like
    the Frozen Pass (0.11), now storm and falls; the Barrow Moor too
    (0.13), now grass over the ground's low tone; and the King's Road
    like the Drowned Coast (0.09), whose surf now has the sea's boom
    and spray.
- **Tests:** app 45 (4 new), art 16, rules 75; the table typechecks.

**Commit:** `git log --grep set/4`.

### set/5: verification, retirement and records

**Changed.**
- **The words' budget fades out instead of stopping at a box** (S9). On
  a phone, the frozen pass's bright snow behind the tall top block was
  dimmed as a hard-edged rectangle. Now:
  - the budget holds one design pixel past the words, then relaxes over
    40 CSS pixels (in the design's pixels on each screen), dithered, so
    it reads as a shadow around the words;
  - the phone names only its name and status as words, not the route and
    the threat beside them, which have their own ground.
- **The old bake is retired:**
  - `scripts/bake-art.cjs` is gone; its backs and grounds were the old
    scene generator's, and the game uses neither;
  - the table's styles for a back's depth layers are gone (S5); the UI
    library keeps the ability;
  - the atelier's README says where the table's art comes from now.
- **Records:**
  - DECISIONS has S1–S11, with W2 and AJ5 amended;
  - STATUS is rewritten;
  - new-settings.md and art-jobs.md point here.

**Verified.**
- **A sweep of every side** (a probe script, in this session's scratch):
  each of the 23 sides started on the board at 1600x1000 and at 390x844.
  - All 46 draw the world (from the worker) and the vista, show the side
    asked for, load their backs, and raise no errors.
  - `proof/set5-all-sides.png` is the contact sheet of all 23 boards.
- **The art check** (`check-art.cjs`, GPU) of every side, at 1600x1000 and
  390x844, across set/3 to set/5:
  - every region of words is within its luminance budget on every side;
  - the colour reservation holds but for three backs and one world, all
    over on the Wanderer's blue:
    - the deep forest's outside back (6.6%) and inside back (5.3%);
    - the Drowned Coast's outside back (7.6%) and world (11–12.5%).
- **A hosted game on the GPU** (`capture-phone.cjs` against
  `local-session.mjs`), every check reached: the phone's world starts
  *Light*, the river lies on it, and scenes pass between board and phone.
- **Tests:** rules 75, app 45, art 16. Both apps typecheck, and the table
  builds.

**Not done here.** Nothing is pushed. A push of `front-door` to `main`
deploys it, the Vercel function included, which is what lets a hosted room
carry the side to phones.

**Commit:** `git log --grep set/5`.

### set/6: the weather, and a picture per line

The author's rulings on set/5's findings: "Allow the weather blue, and add
seeded variations."

**Changed.**
- **A setting may name its weather** (AJ4, amended). One other card
  family may show as weather, up to 15% of a picture where any other
  stays under 5%.
  - The deep forest's night sky and the Drowned Coast's storm sea are
    the Wanderer's blue (`Biome.weather`).
  - `check-art.cjs` tags it *(weather)* and holds it to the 15%.
  - `biomes.test.ts` checks a weather is a family, and not the setting's
    own light.
- **Each narration line draws its card its own way** (S12).
  - The painter has a salt (`PX.withSalt`) on every random number a
    design draws. A line's salt moves whatever the design scatters or
    places at random: the stones' joints and chips, stars, grass, the
    Underdark's fungus forest, the King's Road's crows, the particles.
  - For half a card's lines the whole picture is mirrored, so the light
    and the subject face the other way. Narration ids end in their
    line's number, and the mirror alternates by it from a side chosen
    per card, so every card shows both ways round evenly. Any other seed
    (a phone's card before the GM's scene comes) tosses for it.
  - Seeded by the entry, as the old scenes were: a line always comes
    with the same picture, in every crossing.
  - The vista, the route's landmarks and the storyboard all draw the
    line's picture. With no line (the vista at rest, the backs, the
    world) every design is as approved, to the byte.
- **The vista is drawn in a worker** (`components/vista.worker.ts`), one
  for the page, shared by every vista, landmark and thumbnail. A line's
  picture is built when its card turns, 8 to 40 ms (four times that on
  a phone), which can no longer be prebuilt and would stall the card's
  flip on the page.
  - A new picture stays hidden until its first frame comes, then fades
    in; the old one goes once the fade has run.
  - The page's old cache and idle prebuild are gone.
- `node scripts/variants-sheet.mjs [out.png] [setting:side:card ...]`
  draws cards as approved and as five lines, side by side.

**Verified.**
- **Tests:** art 18 (two new):
  - for every side, no seed is byte-identical to the approved design;
  - a line always draws the same picture;
  - six lines give more than three different pictures;
  - the salt never leaks into the back built after;
  - over every card of every setting, written as the tables write their
    ids, each card's lines mirror as evenly as their number allows, and
    every line's salt is its own.
  - App 45, rules 75; both apps typecheck and the table builds.
- **The variation is seen** (`proof/variants.png`):
  - the desert's shafts slant one way, then the other;
  - the Ember Hold's salamander turns about;
  - the gibbet changes sides on the King's Road;
  - the Underdark's fungus forest rearranges.
  - The first mixing let a card's adjacent ids (`ud-ob1` to `ud-ob6`) all
    fall the same way round, which the test now catches.
- **In the game:**
  - a desert inside walk (GPU): 7 reveals at **0px**; the storyboard's
    two Caravan Tracks are mirrored against each other, and the route's
    landmarks draw;
  - a hosted game: every phone check passes. At 4x CPU the phone costs
    0.19 s per 4 s at rest and 0.79 s for its pick, against 0.26 s and
    1.02 s at set/2;
  - the production build's vista draws from its worker, moves, and
    holds still under reduced motion and a still or off world, with no
    errors.

**Commit:** `git log --grep set/6`.

### Shipped

`front-door` was fast-forwarded into `main` and pushed as `70cdeae` on
2026-10-11, at the author's word ("Merge front-door into main and push"),
after rules 75, app 45 and art 18 passed and the build ran as Vercel runs
it. Vercel reported the deployment complete, and the live site was checked
read-only (STATUS.md has what was checked). A hosted room was not created
live.
