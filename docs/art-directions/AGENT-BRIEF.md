# Designing a Maze Deck setting: the shared brief

You are drawing **two art directions for one setting** of Maze Deck, a dark
fantasy card game. The author rejected a first, built version of the dungeon
for looking plain and murky, so these are design mock-ups shown *before*
anything is built. They must be good enough that the author wants one built.
Quality is the whole job.

## What exists

Everything lives in this folder (call it `designs/`):

- `px.js`: the pixel painter. **Read it fully first.** Do not edit it: four
  other people are working against it at the same time. If you need a helper
  it lacks, write it inside your own scene file.
- `scenes/dungeon.js`: the finished example, two directions (A: the gatehouse,
  B: the deep cells). **Read it fully.** Match its structure, its level of
  craft and its code style.
- `page.html`, `build.cjs`: the review page that shows every direction.
- `inspect.cjs <setting>`: draws your designs large into
  `shots/<setting>/` (back ×4, the vista with each card ×4, the board's wide
  vista ×3, the world ×3), prints build times, page errors, and the world's
  **luminance budget**. Run it after every change and **look at every PNG**
  with your Read tool.
- `shoot.cjs <setting>`: builds the page for your setting alone and
  photographs it as the author will see it: the board mock-up (world, vista,
  backs in the river, caption, hand), the back, the vistas, the section.
  Run it at least at the end, and look.

Run both with `node` from inside `designs/` (Git Bash or PowerShell).

## What you write

One file, `scenes/<setting>.js`, in the dungeon's shape: an IIFE that pushes
two objects onto `window.DESIGNS`, each with

- `job, setting, key ('A' | 'B'), id, name, title, pitch, notes, palette`
  (`notes`: four `[label, text]` pairs: Light, Detail, Vista, World; plain,
  specific sentences a player would understand; `palette`: about nine hexes
  that sum the direction up);
- `back(W, H)`: the card back, always called at **96 × 134**. Static (backs do
  not animate). The game draws a gold arch over it (centre x = W/2, arch top
  ≈ 0.17H, half-width ≈ 0.27W, base line ≈ 0.8H) and a border, so compose the
  picture to be seen *through and around that arch*: the focal point sits
  inside it. It must read at the river's size (about 160 px tall) and still
  at 67 px.
- `vista(W, H, category)`: the picture above the river for the card just
  turned. Called at **192 × 72** (a tablet's shape) and **312 × 62** (the
  board's shape); the game goes as wide as 12 : 1, so compose by height (`u =
  H / 100`) and fill the width with the place, not with stretched shapes.
  `category` is one of `monster, obstacle, wanderer, item, clear-path`; each
  must put a clear, readable subject in the setting's focal spot, in or lit by
  the card's colour (see the dungeon: the monster backlit in the gate, the
  wanderer's lantern, the chest glowing, the portcullis dropping for an
  Obstacle, the light pouring out for a Clear Path).
- `world(W, H)`: the setting behind the whole board, called at **320 × 200**
  (a 16 : 10 screen). The vista covers the top ~30%, so the world shows mostly
  as the ground under the table and the margins. It animates (flickering
  lights, particles).

Each returns `{ p, over(img, t) }`: the Painter, and an optional function
that draws sprites and particles on the snapped picture at time `t`.

## The rules

- **The luminance budget, behind the table.** The world behind the caption
  band, the river and the hand must stay at or under relative luminance
  **0.023** (inspect.cjs prints it; "!! OVER" is a failure). The vista and the
  back are not under the budget: they can be bright.
- **Card colours are reserved.** Each setting lights itself with one card
  family's colour and may use that family freely. Any *other* family's hue
  may appear only small (under ~5% of a picture), except in the card subject
  itself, which is drawn in its card's colour. The families: Clear Path gold
  `#E3A445`, Obstacle teal `#43917B`, Wanderer blue `#6B8CA6`, Item violet
  `#8B4F9C`, Monster red `#A93343`. Keep greys and stone desaturated so they
  never read as one of these.
- **Speed.** A vista builds in under ~30 ms, a world in under ~80 ms
  (inspect.cjs prints them). The page rebuilds a vista when a card is picked.
- **No reference images are available, and none may be copied.** Everything
  is drawn by your code.

## The craft, learned the hard way on the dungeon

What made the first attempts look cheap, and what fixed them:

1. **Value structure first.** The base of everything should be dark (values
   about 1–1.5 on a ramp of 8–10 steps), and the light should be strong and
   local: pools that climb the ramp to warm highlights, falling back to near
   black. Uniform mid-tones are what "plain and murky" looked like.
2. **One focal light per picture**, brightest where the card's subject
   stands. Everything else serves it.
3. **Ramps that shift hue**: cool and dark at the bottom, warmer (or for a
   cold setting, paler) at the top, so light changes colour as it climbs.
   Lights can only move along a ramp; use `p.tint()` for coloured light (a
   card's glow), sparingly.
4. **Texture with structure, not noise**: `masonry` (blocks of uneven width,
   lit top edges, a bevel on the left), `floor` (flagstones in perspective),
   `cells` (natural rock, cobbles, rubble), `grain` only lightly. Watch for
   textures that read as the wrong thing (bricks that look like planks, a
   floor that looks like a wall).
5. **Silhouettes against light** read best at this size: a subject standing
   in front of a glow, with `p.backlit()` giving it a rim.
6. **Detail goes where the eye goes.** A few specific props that tell the
   story (soot above a torch, the bars' shadows on the floor, a shackle on
   the wall) beat busy repetition. Hide repetition in darkness.
7. **Check what you think you drew.** Every round: run inspect.cjs, open the
   PNGs, and write down what is wrong before changing anything. Expect at
   least four or five rounds. If something reads badly, say so and fix it;
   if you cannot fix it, report it.

## When you are done

Report back in under 250 words: what each direction is, what you are
proudest of, what still looks weak, the build times, and the luminance
numbers. Make sure `node inspect.cjs <setting>` runs with no errors and no
"!! OVER".
