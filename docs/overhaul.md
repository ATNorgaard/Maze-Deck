# The overhaul: the plan and its log

The feel pass ([plandoc.md](plandoc.md)) gave the table *beats*: cards are
objects, and outcomes land one at a time. It did not change what the screen
*is*. The screen is still a three-column web app with a card game in the
middle and every interesting moment inside a dialog.

This plan changes what the screen is. The setting fills it. The scene the GM
reads out becomes the thing everyone looks at. Decisions happen on the table
rather than in boxes. The world visibly reacts to how the crossing is going,
and the players' phones become windows into it rather than remote controls.

Written 2026-10-07 from a full walk of the game. Nothing in it is built yet.

## How the analysis was done

- Read the engine (`packages/rules/src/engine.ts`), the choreographer
  (`apps/table/src/stage/`), both play screens, the atelier's generators and
  every doc in `docs/`.
- Walked whole crossings in headless Chromium (Playwright from `.ds-sync`),
  screenshotting every phase at 1600 × 1000 in the dungeon and the frozen
  pass, the lost ending in the deep forest, and the board at 390 wide in the
  desert. Frames through two reveals at 150 / 450 / 900 / 1600 / 2300 / 2900 ms.
- Played an 83-step crossing to the end, logging the DOM and the JS heap at
  every step.
- Measured the frame budget at 390 × 844 with a 4× CPU throttle, with and
  without the animated ground.

The screenshots are in `proof/overhaul/`. That folder is local only, because
`proof/` is gitignored; phase 0 makes the capture a script so they can be
regenerated.

The working tree carries the uncommitted card-back and ground art
(`apps/table/src/biomes/art/`, `backArt` on the skin, and the board's setting
switch). Everything here was observed with that work in place, and the plan
assumes it lands first.

## The flow, as it plays today

A crossing runs about 16 turns (4.2 rounds × 4 seats, from
[balance.md](reference/balance.md)).

| # | Moment | The GM's board | A player's phone | What it feels like |
|---|---|---|---|---|
| 1 | Threshold | Hero title over the setting's motif, a strip of doors, the party sheet, the dials | — | The strongest screen in the app. It already looks like a place. |
| 2 | Start | A cut to an already-dealt board | Code, then seat, then board | A page load |
| 3 | Act | Six action cards on the ledge; working an Obstacle is two `<select>`s and a button | "Your action" panel and a vibrate | Picking from a menu |
| 4 | Check | Centred dialog: the die tumbles 650 ms, the total and verdict land, then *Let it land* or overrule | The die, no verdict, "Waiting on the GM" | A dice-roller widget |
| 5 | Choice (4 of 6 actions, on success) | A second dialog with small copies of cards | Their own dialog | Filling in a form |
| 6 | Pick | The ledge moves to the river | "Commit to a path" | Good. It is the one choice made on the table. |
| 7 | Reveal | Flip and flare (520 + 700 ms). The scene line mounts and shifts the board. A 1.8 s hold, then fly to the discard, settle, pip pop or shake. The refill is dealt and the baton slides. | The same beats, without the scene | The best beat in the game, undercut by the shift |
| 8 | Wanderer | A dialog over the Wanderer and its scene | Nothing (the call is the GM's) | Admin |
| 9 | Encounter | A dialog with three buttons | Nothing | Admin |
| 10 | Round wraps | A number changes in a side panel | The same | Nothing |
| 11 | Over | 1.6 s of dim or fan, then a dialog, then the campaign | "The crossing is over." | A modal |

## What the analysis found

Ranked by how much each one costs immersion.

### 1. The scene is a footnote, and it breaks the reveal when it arrives

The docs say the subsystem's real job is "two or three good scenes and one
fight" ([balance.md](reference/balance.md)), so the scene line is the
product. On screen it is a single 16px centred line with a kicker, squeezed
between the tracks and the river.

- **It moves the board at the worst moment.** The prompt is drawn when the
  card is revealed (`App.tsx`, on `revealKey`), and `.t-scene` is in normal
  flow. So it mounts *during* the flip and pushes the river down about 60px.
  The card being flipped is a `position: fixed` overlay measured a frame
  earlier, so it stays where the slot *was*. For the whole hold, the revealed
  card sits 60px above its own slot and covers the start of the text it is
  meant to introduce. Reproduced in both settings walked
  (`04-reveal-misaligned.png`, `04b-…`).
- **Players never see it.** The prompt is GM-local state (`campaign.prompt`),
  passed to the screen only when the viewer is the GM. A phone gets the log's
  "Something worth picking up, or not."
- **Nothing pictures it.** The card face is a category glyph, so all five
  Clear Paths are the same picture. The text is the only thing that says
  *which* corridor this is.
- **It does not outlive the turn.** Each prompt replaces the last, so at the
  end nothing of the crossing's story remains.

### 2. Every decision happens in a dialog that hides what it is about

Every action is a check, so every turn opens at least one modal. Four of the
six actions open a second on success, and a Wanderer adds a third. At DC 15
and +3, with actions chosen evenly, that comes to about 1.5 dialogs a turn,
or roughly 25 a crossing. Each one blurs the whole board:

- The Wanderer's stay-or-go blurs the Wanderer itself, and the scene line the
  GM is meant to narrate it from (`05-wanderer-dialog.png`).
- Scout Ahead, It's Elementary and Careful Consideration show small copies of
  cards that are, or are about to be, on the table behind the blur
  (`06-scout-dialog.png`).
- The roll is the most dramatic object in the game, and it is a 280px box
  with a die the size of a button (`03-the-roll.png`).
- The encounter is the run's one fight, and it is a dialog with three
  buttons. Nothing in the world changes when the party is found.

### 3. The screen is a dashboard, and the table is the empty part

At 1600 × 1000, 620px of the width goes to side panels: run info,
initiative, the controls (Campaign / Preview / Sound / Setting / End the run)
and the log. The admin controls hold the most prominent column on the screen
for the whole run. The river and the piles sit in the middle with dark space
round them.

The sixth action wraps to a second row **below the fold** at 1000px tall,
taking with it the ledge that is meant to say "look here"
(`02-actions-below-fold.png`). Working an Obstacle is a form in the middle of
the table.

### 4. The world does not react to how the crossing is going

- Progress is five hollow circles and threat is two. One strike from being
  found, the room looks exactly as it did on turn one.
- Nothing marks a new round except a number in the side panel.
- A jam is the most dramatic thing the deck does on its own: three
  Obstacles, the river swept, and a Monster fed to the discard. It shows as a
  log line and a deal.
- Starting a crossing cuts straight to a dealt board, with no shuffle, no
  title, and no threshold crossed.
- The ground breathes on a fixed loop, whatever the state.

### 5. Players' phones are spectators

A phone shows the river, the tracks, the order, the log, and an action bar
on its own turn. It has no scene, no picture of where the party is, and
nothing for the player's hands between turns. In manual roll mode the player
is told "Roll your d20 and tell the GM." The only haptic is a double tap when
the turn arrives.

### 6. The ambient layer is the expensive kind of motion

The new grounds animate with SMIL inside a 2560 × 1440 SVG used as a CSS
background, with an `feTurbulence` texture, so every animation frame
re-rasterises the picture. Measured at 390 × 844 with a 4× CPU throttle,
over 4 seconds of an idle board:

| | Main-thread task time | Style recalc |
|---|---|---|
| Frozen pass, as shipped | 1.22 s | 0.11 s |
| Frozen pass, ground removed | 0.25 s | 0.02 s |
| Dungeon, as shipped | 1.15 s | 0.10 s |
| Dungeon, ground removed | 0.25 s | 0.01 s |

Headless held 60fps, because rasterisation is off the main thread there. Even
so, about a quarter of the main thread goes to the ground at idle, before any
beat plays. STATUS.md listed this as not yet measured. It is measured now,
and it is the cost the new atmosphere has to beat rather than add to.

In two screenshot-heavy runs, the headless renderer crashed mid-crossing
(once after a Wanderer, once after a Scout). An 83-step crossing without
screenshots did not crash, and the JS heap stayed between 8 and 15MB. So it
is most likely a headless-capture artefact, but it deserves one look on a
real phone before more art goes on the ground.

### 7. Smaller things found on the way

- Scout Ahead's dialog says "Players are told a card was set, never which".
  The engine has logged the card publicly ("Clear Path goes on top of the
  deck") since the peeks were made public, so the copy in `ChoicePanel.tsx`
  is stale.
- At 390 wide the GM board clips the river at both edges. That is known and
  deliberate (STATUS.md, "the hard floor"), and the new layout should not
  inherit it.

### 8. The rules cap the drama

This is not a visual problem, but it is the ceiling. Per
[balance.md](reference/balance.md), a failed check costs nothing (you pick a
path either way) and the card game cannot be lost. Visuals can make a roll
*look* tense; they cannot make it *matter*.

Every part of this plan stands without a rules change, and the threat visuals
are built to scale if one is ever made. It is flagged here so the overhaul is
not judged against a tension the rules do not create.

## The direction

Five ideas, each traceable to a finding:

1. **The setting fills the screen.** The world is a full-bleed layer, and the
   chrome goes into drawers. (3, 4)
2. **The scene is the centrepiece.** Every drawn entry gets a picture and is
   set large, in space reserved for it, so it never moves anything. (1)
3. **Decide on the table.** Choices happen where the cards are. The roll and
   the encounter stay centred and blocking, but at the size of the moment.
   (2)
4. **The world keeps score.** Progress is a route, threat is the dark closing
   in, and rounds, jams and reshuffles are events. (4)
5. **Every device is a window.** A phone sees the place and the scene, holds
   its hand of actions, and feels the beats. (5)

One engineering idea sits under all of it: **one mood, many layers.** A
single `mood`, derived from the *presented* view, drives the light, the
particles, the vignette, the sound and the haptics, so they never disagree. A
quality tier decides how much of it a device draws.

### The new board

```
┌────────────────────────────────────────────────────────────────────────┐
│ THE ASHEN TOWER · Frozen pass · Round 2             join 5ZNQYE    ☰ GM │  thin top rail
│ ●────●────◆────○────○──────▸ the far side         ░░ the dark  1 of 2  │  the route, the dark
│                                                                        │
│          ╭──────────────────── the vista ────────────────────╮         │
│          │   the setting, lit by the card just turned;        │         │  the world layer,
│          │   at rest, the horizon ahead                       │         │  behind everything
│          ╰────────────────────────────────────────────────────╯         │
│      SWITCHBACK   "A rope, fixed to iron pins, running up the next      │  the scene, in a
│                    pitch. Somebody came this way and meant to…"         │  reserved band
│                                                                        │
│   ▤ deck      [  left  ]      [ centre ]      [ right  ]     discard ▥ │  the river on a lit
│                                                                        │  table, piles flanking
│              ◉ Wren     ○ Odalis     ○ Brakka     ○ Sable              │  the party rail
│      ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮                   │  the hand: six actions,
│      │FORGE│ │SCOUT│ │STEEL│ │ELEM.│ │CONS.│ │BOOST│                   │  fanned, rising on a turn
└────────────────────────────────────────────────────────────────────────┘
   ☰ GM drawer: campaign · preview · sound · setting · new/old board · end the run
   ▤ chronicle drawer: the log; its newest line also shows as a caption
```

## Phases

Each phase is its own commit, with a subject tagged `world/N`, so any phase
can be found and reverted alone.

| # | Phase | Size | Needs | Status |
|---|---|---|---|---|
| 0 | Fix and measure: the reveal shift, the stale copy, a walk-capture script, a frame-budget script | S | — | **done** — `world/0`, except the look on a real phone |
| 1 | The new board, beside the old: world / table / rail / hand layers, GM and chronicle drawers, piles flanking the river, behind a toggle | L | 0 | **done** — `world/1` |
| 2 | The vista: the atelier's scene generator in `packages/art`, rendered live for each drawn entry; the scene set large | M | 1, D5 | **done** — `world/2` |
| 3 | The world layer: one WebGL2 canvas for light, fog and particles per setting, driven by `mood`, with quality tiers; replaces the SMIL grounds | L | 1, D4 | **done** — `world/3` |
| 4 | Decide on the table: Wanderer, Scout, Swap, Consider and Boost in place; the roll restaged; the encounter as a takeover | L | 1, D3 | **done** — `world/4` |
| 5 | The world keeps score: the route, the dark, round marks, the jam, the reshuffle | M | 2, 3, D2 | **done** — `world/5` |
| 6 | Cards with weight: tilt and sheen, back art in depth, piles with thickness, a signature per category on the reveal | M | 1 | **done** — `world/6` |
| 7 | Ceremony: the opening, and the chronicle at the end | M | 2 | **done** — `world/7` |
| 8 | Windows: the phone gets the vista, the shared scene, the hand, a throw, haptics per beat | L | 2, 3, D1 | **done** — `world/8` |
| 9 | Sound as a bed: per-setting ambience, synthesised, moving with the mood | M | 3, D6 | **done** — `world/9`, except hearing it |
| 10 | Retire the old board, re-measure, record what was decided along the way | S | all | **done** — `world/10` |

**Order of execution: 0, 1, 2, 3, then the author's first look, then 4, 5,
6, 7, 8, 9, 10.** Phases 1–3 together are a vertical slice: the new board,
the vista and the living world in every setting, enough to judge the
direction before the bulk of the work is spent on it. Three beats in the feel
pass were reversed after the author first saw them (2b, 3b, 9b). Planning for
that is cheaper than hoping it will not happen.

### 0. Fix and measure

- **The reveal shift.** Reserve the scene's space so it never pushes the
  river. Either give `.t-scene` a fixed band from the first turn, or take it
  out of flow. This is a fix for *today's* board, and it is worth making
  because the old board stays playable until phase 10.
- **The stale Scout copy** in `ChoicePanel.tsx`.
- **`scripts/capture-walk.cjs`**: walk a crossing and screenshot every phase,
  with frames through the reveals. This analysis's method, kept as the
  verification loop for every later phase, because the browser pane renders
  no frames.
- **`scripts/measure-frames.cjs`**: the frame-budget probe above. Record the
  baseline here, and re-run it at the end of phases 3, 5, 6 and 9.
- **One look at the ground on a real phone**, for the crash noted in finding 6.

### 1. The new board, beside the old

- **A new screen beside the old.** `apps/table/src/screens/TableScreen.tsx`
  uses the same `useStage`, the same transport and the same `availableFor`.
  `SessionScreen` stays untouched and selectable through a "New table" switch
  in the GM drawer, remembered per device (D7).
- **The layers:**
  - `world`: fixed, behind everything; it holds the vista and, later, the
    canvas.
  - `table`: the river, with the deck on its left and the discard on its
    right, where they would sit on a real table.
  - `rail`: the party as tokens, with the baton.
  - `hand`: the six actions as cards fanned along the bottom edge, rising on
    a turn.
  - `top rail`: run name, setting, round, join code, and slots for the route
    and the dark.
  - Two drawers: the GM's controls, and the chronicle (the log).
- **Obstacle work moves onto the Obstacle card.** A face-up blocker in the
  river carries a "Work on it" affordance, with the suggested ability and DC
  as chips. R6's adopt-then-override behaviour is unchanged.
- **Budget:** every control on screen without scrolling at 1366 × 768 and at
  1920 × 1080. Re-measure the `useFittingSize` thresholds for the new column,
  since the river now gets the full width minus the piles.
- **Keep:** no transform on the table's ancestors. The overlay measures with
  `getBoundingClientRect`, which is why the GM board has no ScaleToFit today.

### 2. The vista

- **Move the generators into a shared package.** Move
  `apps/atelier/src/core/{rng,biomes,style}.ts` and
  `gen/{scene,ground}.tsx` into `packages/art`: pure, React-only, aliased to
  source like the others, with no workspace root. The atelier then imports
  from it. Nothing in `packages/ui` changes, so the design-sync is not
  touched (D5).
- **Render it live.** Draw `SceneArt` with `frame: 'wide'`, seeded by the
  setting plus the entry id, lit by the revealed card's category, with the
  palette read off the provider (`readPalette`) and the subject on. At rest
  (no prompt yet), the vista shows the setting's horizon with no subject:
  where the party is.
- **The caption.** The entry text is set large in the body face, in a band
  reserved from the first turn. The kicker uses the setting's own name for
  the card (*Switchback*, not *Clear Path*). The caption is GM-only until D1
  says otherwise.
- **Subjects.** Today a scene's subject is fixed per category. Add an
  optional `subject` on `TableEntry` (lantern, rope, door, figure, tracks,
  cairn…) for entries that name a thing, inferred from keywords when absent.
  Writing subjects in can happen at leisure. A GM's own entries get a vista
  too, because the seed is the entry id.
- **The transition** is an opacity crossfade from horizon to scene as the
  card turns, and back on the next action.
- **The card face is not touched.** That was the author's call on the second
  atelier pass.
- **Cost.** Generate on reveal and memoise by seed. Pre-generate a setting's
  31 entries in idle time. Measure the generate time at 4× CPU before
  deciding whether that is needed.

### 3. The world layer

- **One canvas behind everything.** A WebGL2 fragment shader draws the pool
  of light, the fog bands and the vignette. Instanced particles draw the
  setting's air, which the atelier's vocabulary already names: dust, embers,
  motes, sand, drips, snow. No dependency, around 300 lines (D4).
- **Driven by `mood(presented)`:** `{ focus, threat, progress, phase,
  outcome, flash }`, where `focus` is a point on screen, `threat` and
  `progress` run 0–1, and `flash` is a category or null. The light leans
  quietly towards where the phase is, the river or the hand. That is the
  ledge's job, done by the world.
- **Quality tiers:**
  - `high`: the shader plus particles.
  - `low`: the shader at half resolution, with fewer particles.
  - `still`: the baked still picture, with `animate` off in `bake-art.cjs`.

  The tier is chosen from `devicePixelRatio`, `hardwareConcurrency` and the
  frame time measured over the first two seconds. It drops a tier if frames
  run long, goes to `still` under reduced motion, and pauses when the tab is
  hidden.
- **The SMIL grounds stop being the default.** They survive as the `still`
  tier's picture and as the fallback where WebGL2 is missing.
- **Budget:** at or under 0.35 s of main-thread time per 4 s at 4× CPU,
  against 1.2 s for today's ground, measured with phase 0's script.
- **On desktop, pointer parallax:** the world shifts a few pixels with the
  pointer.

### 4. Decide on the table

- **Wanderer:** the card stands up in its slot with its scene in view, and
  *They stay* / *They move on* underneath it.
- **Scout Ahead:** three cards fan off the deck pile, and the chosen one
  slides back onto it.
- **It's Elementary:** two cards fan above the deck. Pick one, then a river
  slot lights to take it, and the displaced card flies to the discard.
- **Careful Consideration:** the two turned cards stay in the river with
  *Strike this one* on each.
- **Boost Morale:** the party rail lights up. Tap a seat and a light passes to
  them.
- **The roll stays centred and blocking**, as decided in feel/3b, but it
  becomes a stage rather than a box (D3). The board dims. The action card that
  was played lifts to the centre beside a die about three times today's size.
  The DC is a mark the total has to reach. The verdict washes the world's
  light (via `mood.flash`) as well as the panel. It is the same Radix Dialog
  underneath: focus trap, inert board, Escape blocked.
- **The encounter becomes a takeover.** The threat light floods in from the
  edges, the vista shows the last Monster scene drawn, and *Roll initiative*
  is set large. The three outcomes are as before.
- **No authority changes.** Every choice sends the same `RESOLVE_CHOICE`
  payloads as today.
- **Keep it keyboard-complete.** In-place choices need roving focus and
  instructions announced through `aria-live`.

### 5. The world keeps score

- **The route.** Escape progress is a path across the top rail, from the
  threshold to the far side, with `escapeTarget` waypoints. Each Clear Path
  pins a landmark (a thumbnail of that scene) and moves the party marker, and
  the vista's horizon steps forward once.
- **The dark.** Each strike tightens the vignette, cools and reddens the
  light, and adds shapes at the edge in the setting's own idiom. One strike
  short of being found, the particles slow and the ambience drops (phase 9).
  The pips stay as the plain readout.
- **Round marks.** "Round 2" passes over the table on the turn beat that
  wraps.
- **New beats:** `jam` (the river swept, and a Monster card visibly fed to
  the discard), `reshuffle` (the discard gathered back into the deck) and
  `found`. Today the choreographer could only infer these from changes in the
  counts, and the jam and the reshuffle are ambiguous that way. D2 makes them
  explicit.

### 6. Cards with weight

- Pointer tilt and a sheen across face-up cards: a transform and a gradient
  overlay, nothing else.
- Backs in depth: split the baked back art into sky, horizon and near layers,
  so the doorway has parallax as the card tilts. Either `bake-art.cjs` emits
  the layers, or the runtime generator draws them.
- The deck pile shows its thickness, with stacked edges that scale with the
  count. The discard is a slightly scattered stack showing its last three
  cards.
- Anticipation before a pick: on press the card lifts towards the viewer,
  then turns.
- A signature for each category on the reveal, extending feel/4:
  - Clear Path: light pours out of the arch towards the route.
  - Monster: red seeps into the dark, with a low growl.
  - Obstacle: a slam and dust.
  - Item: a slow turn and a glint.
  - Wanderer: the card stands up.

### 7. Ceremony

- **The opening.** On Start, the crossing's name appears over the setting's
  horizon, the deck is shuffled, three cards are dealt, and the party's
  tokens drop onto the rail in initiative order. About 4 s, skippable by any
  input, and a cut under reduced motion.
- **The chronicle.** Every prompt drawn is kept for the run, in a `chronicle`
  list beside `campaign.prompt`. It stays app state, not `GameState`, as A5
  and STATUS intend. The end screen becomes the crossing as a storyboard:
  each scene's vista thumbnail, who took the path, and in which round, plus
  the rounds and encounters, and "Back to the campaign". The GM can read the
  recap out, or pick up from it next session. Feel/8's *through* and *lost*
  beats still play first.

### 8. Windows

- **On a phone:**
  - the vista on every reveal;
  - the scene text, when the GM shares it (D1);
  - on its own turn, the hand of six filling the screen;
  - in manual roll mode, a large die to throw with a tap or a flick. The GM
    still types the result in: the phone's throw is ceremony, not authority;
  - a haptic for each beat: a long buzz for a strike, a light tick for a
    Clear Path, a pattern for being found;
  - the world layer at `low`.
- **Transport for D1.** Add a GM-only `share` op to `api/session/[op].ts` that
  writes a `scene` column on the room row (a migration). The column is
  returned in the player's view response and bumps the version like any other
  change. The engine and `GameState` are untouched, as A5 wants.

### 9. Sound as a bed

- **Ambience for each setting**, synthesised in WebAudio like the existing
  voices, with no files:
  - the frozen pass: wind (filtered noise);
  - the dungeon: drips and a long room;
  - the undercity: crackle;
  - the deep forest: insects and leaves;
  - the desert: hiss and gusts;
  - the tower: a far bell and wind.
- **It moves with the mood.** Threat adds a low pulse and narrows the filter.
  Near the far side the bed opens up. Beats duck it. It uses the same toggle
  as today; D6 decides whether the threshold asks once.

### 10. Retire and record

- When the author is happy, `TableScreen` becomes the board, and
  `SessionScreen` and its CSS go.
- Re-measure the size table.
- Rewrite STATUS.md.
- The decisions above are already in DECISIONS.md (O1–O8). Add whatever is
  decided along the way, and the shapes that were only planned here: the
  art package, and the room's `scene` column.

## Decisions for the author

**All eight were taken as recommended, 2026-10-07** ("go with your
recommendations"). They are recorded in [DECISIONS.md](DECISIONS.md) as
O1–O8.

| # | Question | Decided |
|---|---|---|
| D1 | Do players see the scene text? | **Yes, when the GM shares it**: a *Show the table* control on the GM's caption, per scene, plus a campaign setting to make it automatic. The GM keeps the read-it-first moment that the hidden-information model was built around. |
| D2 | One small, additive engine change: a `cue` on `GameEvent` (`jam`, `reshuffle`, `found`, `through`…), so the stage plays what happened instead of inferring it from counts. | **Yes.** It is additive, every rules test stays as it is, and it adds one test per cue. It is the only engine change in this plan. *(Phase 8 added a second of the same kind, `turned` on a pick's line: see `world/8`.)* |
| D3 | Restage the roll as a centre-screen moment that fills the board, still as a blocking dialog. | **Yes.** It keeps feel/3b's call (centred, modal) and changes only its scale. |
| D4 | A WebGL2 canvas replaces the SMIL grounds as the default. | **Yes**, with the still picture as the fallback tier. No dependency. |
| D5 | A `packages/art` for the generators, shared by the atelier and the table. | **Yes.** It keeps `packages/ui` and the design-sync out of it. |
| D6 | Sound: keep it off by default, but ask once at the threshold? | **Ask once.** A table that never finds the toggle never hears the bed. |
| D7 | Build the new board beside the old one behind a toggle, and retire the old one at the end? | **Yes.** Three beats have been reversed after a first look; a side-by-side makes reversing cheap. |
| D8 | Give a failed check a cost, or make a third strike something worse ([balance.md](reference/balance.md))? | **A separate decision.** Nothing in this plan depends on it. |

## Constraints held throughout

- Things that move on the DOM use transforms and opacity only; the canvas
  does the rest. Never animate layout. 60fps on a phone, at that phone's
  tier.
- Every beat respects reduced motion and can be skipped by an input. A fast
  GM is never made to wait, except at the ending, as now.
- The truth is never edited. Dispatch decisions come from `view`; what is
  drawn comes from `presented`.
- Each client animates from its own view stream. Nothing about animation
  goes to the server.
- No art that is not ours (A7). Every picture comes from the atelier's
  generators, seeded.
- These stay exactly as they are:
  - the card face, with its arch glyph and symbols, as designed;
  - the print deck;
  - the canonical names on the eyebrows;
  - the colour families, which are never swapped.
- Persistent indicators stay quiet, the lesson of feel/9b. Only moments get
  to be loud, and only briefly.
- No npm workspace root. Packages stay aliased to source.
- One commit per phase, tagged `world/N`. STATUS.md names the next action at
  the end of every session.

**Not doing:** a 3D engine, image assets of any kind, a different card face,
a rules change (D8 aside), accounts or spectator links.

## Log

Written as the work happens. Every phase records what changed, what broke,
what was retried, and the commit.

### world/0 — fix and measure

**Changed.**
- `SessionScreen.tsx`: the scene band is on the GM's board from the first
  turn. `.t-scene` carries `data-empty` (and is invisible) until a card is
  turned, and announces itself with `aria-live="polite"`.
  `.t-scene__text` holds two lines open (`min-height: 2em × leading`).
  Mounting a prompt no longer moves the river.
- `useStage.ts`: while a turned card is held (the overlay is up and not yet
  flying), it **follows its slot**. It is re-measured after every render of
  the screen, and on scroll and resize. That covers what the band cannot:
  a GM's own entry longer than two lines, the error notice appearing, or
  the page scrolled mid-hold. The flight to the discard then starts from
  where the card really is.
- `ChoicePanel.tsx`: Scout Ahead now says the table is told which card goes
  on top, which has been true since the peeks were made public.
- `scripts/capture-walk.cjs` (new) photographs a whole crossing, every
  moment once, the first reveals as frames, and the ending. It also measures
  how far each turned card stands from its slot, and exits non-zero if
  that is more than 1px or the renderer crashes. Writes `walk.log`.
- `scripts/measure-frames.cjs` (new) is the frame budget below, as a script
  that prints the table.
- `scripts/capture-frames.cjs` now reads the phase from
  `.t-board[data-focus]`. It still looked for `.t-phase__title`, which has
  been gone since feel/9, so it would have hung on its first cycle.

**Design notes.**
- **The band costs height.** On turn one the river sits 82px lower than it
  did: a 63px band plus one 19px gap. At 1600 × 1000 the first row of
  actions now dips below the fold until a scene has been drawn. Once one
  has, the old board was 60px taller as well, so the steady-state cost is
  22px, the second line. That is accepted for the old board, because phase 1
  owns the vertical budget.
- **Two lines is enough for every built-in entry.** The longest of the 186
  (128 characters) is two lines at every width from 2085 down to the 580px
  floor.
- **Both fixes, not either.** The band alone leaves the cases above. The
  follow alone keeps the card on its slot, but the whole board would still
  jump 60px mid-flip.

**Broke / retried.**
- capture-walk's ending was never photographed on the first run. At the
  step limit a roll dialog was open, Radix marks the rest of the page inert,
  and "End the run" was not found. The script now answers whatever is
  still owed before it closes the run.
- Run against run, absolute timings drift. The first probe measured the
  dungeon's idle ground at 1.15 s, and the script's run below measured
  0.63 s. Compare rows from the same run, never across runs.

**Verified.**
- capture-walk, dungeon, 1600 × 1000: 20 reveal samples, worst offset
  **0px**. Before the fix it was ~60px.
- The check was proven to catch the bug. With the band's reservation
  removed by injected CSS, the first reveal stood **22px** off its slot and
  the script failed. With the follow added, the same broken band gave
  **0px**.
- Scrolling mid-hold at 1600 × 760: after 150px of scroll the card sat
  **0px** off its slot. One sample taken *during* the scroll read 10px,
  which is a frame of lag.
- `npm run typecheck` is clean and the app's 11 tests pass. `packages/rules`
  was not touched.
- capture-walk, frozen pass, a whole crossing to the ending: 32 reveal
  samples at **0px**, with the encounter, three kinds of choice and the
  ending photographed. There was **no renderer crash** in 25 screenshots,
  past the point where the analysis's scratch script crashed twice. That
  script also took full-page screenshots, which resize the viewport under
  a fixed, 112%-sized, animated ground. That is the likeliest trigger, so
  capture-walk takes viewport shots only.

**The baseline.** `node scripts/measure-frames.cjs`, 390 × 844, 4× CPU,
4 s per idle row and 6 s per turn row. Main-thread task time is the number
to hold each phase to; headless frame rates flatter a real phone.

| | Main-thread task | Style | Layout | fps | Worst frame | Frames > 33 ms |
|---|---|---|---|---|---|---|
| dungeon, idle | 0.63 s | 0.06 s | 0.00 s | 60 | 17 ms | 0 |
| dungeon, idle, ground still | 0.13 s | 0.00 s | 0.00 s | 61 | 17 ms | 0 |
| dungeon, one turn | 1.74 s | 0.29 s | 0.04 s | 59 | 100 ms | 1 |
| tower, idle | 0.70 s | 0.06 s | 0.00 s | 60 | 17 ms | 0 |
| tower, idle, ground still | 0.12 s | 0.00 s | 0.00 s | 61 | 17 ms | 0 |
| tower, one turn | 1.90 s | 0.33 s | 0.03 s | 59 | 117 ms | 1 |
| deep-forest, idle | 0.76 s | 0.07 s | 0.00 s | 61 | 17 ms | 0 |
| deep-forest, idle, ground still | 0.12 s | 0.00 s | 0.00 s | 61 | 17 ms | 0 |
| deep-forest, one turn | 2.13 s | 0.36 s | 0.05 s | 58 | 183 ms | 1 |
| desert, idle | 0.88 s | 0.08 s | 0.00 s | 60 | 17 ms | 0 |
| desert, idle, ground still | 0.21 s | 0.00 s | 0.00 s | 61 | 17 ms | 0 |
| desert, one turn | 2.80 s | 0.48 s | 0.07 s | 56 | 183 ms | 5 |
| undercity, idle | 1.02 s | 0.08 s | 0.00 s | 60 | 17 ms | 0 |
| undercity, idle, ground still | 0.19 s | 0.00 s | 0.00 s | 61 | 17 ms | 0 |
| undercity, one turn | 3.01 s | 0.49 s | 0.08 s | 57 | 233 ms | 4 |
| frozen-pass, idle | 1.03 s | 0.08 s | 0.00 s | 60 | 17 ms | 0 |
| frozen-pass, idle, ground still | 0.17 s | 0.00 s | 0.00 s | 61 | 17 ms | 0 |
| frozen-pass, one turn | 3.08 s | 0.50 s | 0.08 s | 55 | 233 ms | 6 |

What it says:
- **At idle**, the animated ground is 5–6× the cost of a still one in every
  setting.
- **During a turn**, the three heaviest grounds (desert, undercity, frozen
  pass) drop 4–6 frames of over 33 ms, with worst frames of 183–233 ms. The
  three lighter ones drop one.

Phase 3's target stands: a living world for less than today's still-ground
cost plus a margin, at most 0.35 s per idle row.

**Owed to the author:** one look at the animated ground on a real phone.
It is a deploy away, or on the dev server over the LAN with
`npm run dev -- --host`.

**Commit:** `git log --grep world/0`, on the `overhaul` branch. The
atelier's art went in just before it as its own commit (`art: …`),
because the two shared `SessionScreen.tsx` and `app.css`. The art commit
was checked to build on its own.

### world/1 — the new board, beside the old

**Changed.**
- `screens/TableScreen.tsx` (new) is the GM's board rebuilt as one
  screen. From the top:
  - a thin rail with the run and both tracks;
  - the scene band;
  - the surface, with the deck on the river's left and the discard on its
    right;
  - the bottom edge: the party as tokens on the left, the six actions as a
    fanned hand in the middle, and the newest two lines of the log on the
    right.

  The GM's controls are in a drawer (`components/Drawer.tsx`, Radix
  Dialog as a side sheet). The full log is a chronicle column that opens
  beside the table and is remembered per device. It uses the same stage,
  transport, view and dialogs as the old board.
- **The hand** is always on the table. When an action is owed it rises;
  otherwise it sinks so only the cards' tops show, dimmed and `inert`.
  The fan is computed in CSS from each card's place and the number of
  actions in play (`--i`, `--n`).
- **Working an Obstacle moved onto the Obstacle**
  (`components/ObstacleWork.tsx`). A face-up blocker carries *Work on
  it*, which opens on the card's face into the six abilities, a DC
  stepper (±2, as before) and *Roll*. It is positioned from the slots'
  layout boxes.
  - **Each blocker keeps the check its own scene suggested**, by slot. The
    old board adopted the latest scene's suggestion, which was the wrong
    card's once anything else had been turned since. The latest scene is
    still the fallback, so R6 is unchanged.
- `useTableFit.ts` (new) picks the card step from the surface's width
  **and height**, with the piles one step under the river. It uses
  measured sizes (river sm 541×261, md 873×422, lg 1179×569; pile sm 162,
  md 261 wide). Too narrow for a pile either side of a `sm` river, the
  piles go under it and the page may scroll.
- `App.tsx`: which board a run is played on is a per-device choice
  (`mazedeck.board`), **new by default**. *Use the old board* is in the
  drawer, and *Use the new table* is on the old board's controls. The old
  board is otherwise untouched.
- `app.css`: the shared ledge and shake now switch on for `.t-table`
  too. Everything else for the new board is in `table.css`, so retiring
  the old one later is a deletion.
- `stage/useStage.ts`: a turned card is measured where it **rests**, read
  through its slot, rather than off the card (see *Broke* below). This
  affects both boards.
- `capture-walk.cjs` drives either board (`--board=`), finds "End the
  run" in the drawer, and samples every reveal's hold every ~50ms
  against the resting card. `measure-frames.cjs` takes `--board=` too.

**Design notes.**
- **Height is the scarce dimension.** The fixed rows (top rail, scene
  band, bottom edge, gaps) cost about 311px, and the surface gets the
  rest. Measured with no scrolling at every size:

  | Viewport | River |
  |---|---|
  | 1920 × 1080 | `lg` |
  | 1600 × 1000 | `md` |
  | 1366 × 768 | `md` |
  | 1280 × 720 | `sm` |
  | 1024 × 768 | `sm` |

  A real 1366 × 768 laptop has only about 657px of viewport inside a
  browser, which leaves `sm` there. 1440 × 900 and 1536 × 864 laptops
  get `md`.
- **The step a laptop is missing is between `sm` (0.62mm) and `md`
  (1mm).** STATUS says to add a size step rather than move the base, but
  that is a change to `packages/ui` and its design-sync, so it is the
  author's call. It is listed below as D9.
- **The chronicle is a column, not an overlay.** Opening it narrows the
  table, and the fit takes a step down if it must. At 84u it cost `md` at
  1600 wide by 17px; it is 80u now and keeps it.
- **On a narrow window the hand lies flat and wraps.** Six fanned cards are
  wider than the screen, and the outer ones were clipped out of reach.
  This turned up only because the frame-budget probe drives the board at
  phone width. The GM board's hard floor (~580px) is the same as the old
  board's.

**Broke / retried.**
- **A revealed card stood 10px above its slot** in about one reveal in
  ten, on both boards. A frame-by-frame trace of every row's height
  showed nothing moved in the layout. The cause was the pointer's lift: a
  pickable card under the cursor is raised 10px by a transform *on the
  card*. The overlay measured the raised card, then the card dropped back
  under the mask as the pick landed. The four-moment sampling in world/0
  missed it, because it is a 200ms transient. The fix is that the stage
  now measures through the slot, which is never transformed in play, and
  so does the check.
- **Vite served a stale `SessionScreen.tsx` for the third time on this
  setup.** *Use the new table* was on disk but not served. Fixed the
  usual way: stop the server, delete `node_modules/.vite`, start it, and
  `curl` every changed module for its last edit before trusting a test.
  Every test in this entry was re-run after the restart.
- **The trace script waited Playwright's 30s default for a dialog title
  that was not there**, every step. Probes now ask `count()` first.

**Verified** (headless Chromium, after the restart):
- **Full crossings.**
  - New board, deep forest: 136 reveal samples over 12 reveals, worst
    offset **0px**. Roll, every kind of choice, the Wanderer, the
    encounter and the ending were all photographed.
  - Old board, tower: 209 samples over 14 reveals, **0px**.
- **No scrolling at five sizes**, with the steps in the table above.
- **The drawer.** Focus moves into it, Escape closes it, and *End the
  run* works from it.
- **The chronicle.** `aria-expanded` follows it, and with it open at 1600
  the river stays `md`.
- **The board choice.** The switch both ways works, and the choice
  survives a reload.
- **Working an Obstacle**, at 1600 × 1000 and 1366 × 768. The panel opened
  on the blocker's *own* suggestion (WIS at +1 opened at DC 16, while a
  Wanderer's scene was on the band). Overruled to CHA and raised once,
  the log read *"… clearing the left path — CHA check against DC 17."*
- **The frame budget**, measured in one run, at phone width. Both boards
  sit on the same still-ground floor (0.15–0.16 s idle), and their turn
  rows are within noise of each other:

  | Board | Dungeon turn | Frozen pass turn |
  |---|---|---|
  | Old | 2.88 s | 2.61 s |
  | New | 2.11 s | 2.22 s |
- `npm run typecheck`, `npm test` (11) and `npm run build` are clean.

**Commit:** `git log --grep world/1`.

### D9 — for the author

A size step between `sm` and `md` (around 0.8mm) would give a real
1366 × 768 laptop a river about 30% larger than the `sm` it gets now.
It means a new `CardSize` in `packages/ui` (tokens, type and
design-sync) and one more row in each fit table. It is not needed for
anything else in the plan.

### world/2 — the vista

**Changed.**
- **`packages/art` (new) is `@maze-deck/art`.** It holds `rng.ts`,
  `biomes.ts`, `style.ts` and `scene.tsx`, moved out of `apps/atelier`
  with `git mv` so their history follows. It is consumed as source like
  the other packages: both apps alias it, and the atelier now imports
  from it. Neither `packages/ui` nor the design-sync was touched (D5).
- **No `node_modules` in `packages/art`, so React is the app's, by
  name.**
  - Both `vite.config.ts` files set `resolve.dedupe: ['react',
    'react-dom']`.
  - Both `tsconfig.json` files map `react` and `react/jsx-runtime` to the
    app's own `@types/react`.
  - The production bundle was checked: one React (one version string
    each for react and react-dom).
- **The generator gained a `vista` frame.** It is a landscape of any
  aspect (`aspect`, 1.2–12), cropped from the top so the subject's floor
  is never lost. A wider landscape gets more features, by the square
  root of the extra width (see *Broke*). The `wide`, `back` and `arch`
  frames come out exactly as before. The atelier's Scene bench has the
  frame, with an aspect slider.
- **`components/Vista.tsx` (new)** measures its own box and draws the
  scene composed for that aspect, half-step buckets so a resize does not
  redraw per pixel. It reads the palette off the live CSS and crossfades
  over 900 ms (`MOTION.vista`). Each picture is memoised on its key.
  - **The seed is the setting plus the entry's id**, not the draw, so the
    same line always comes with the same picture, in every crossing. A
    GM's own entries get one too.
  - **Before the first card turns** it is the setting's horizon at rest,
    in the setting's own light, with no subject.
- **The board's middle is now a stage:** the vista, the caption under it,
  and the surface. `useTableFit` measures the stage, takes the caption's
  reserved band off, sizes the river from what is left, and the vista
  gets the rest.

  | Viewport | Vista height |
  |---|---|
  | 1600 × 1000 | ~240px |
  | 1920 × 1080 | ~160px (the `lg` river is tall) |
  | 1366 × 768 | none, and the river keeps `md` |

  Below 56px the vista steps aside rather than show a strip. On a narrow
  window it is a fixed 40u band.
- **The caption is 19px.** Its kicker names the card as the setting does
  (*Switchback*, *Slip Face*, *Caravan Track*), in the card's own colour.
  The card's eyebrow keeps the canonical name.

**Departures from the plan, and why.**
- **The vista is a band above the caption, not a full-bleed world
  layer.** The generator stands its subject on the floor in the middle,
  and the middle of the board is the river. Full-bleed, the subject
  would always have stood behind the cards. As a band it reads as a
  storybook page — picture, caption, then the choice — and it takes only
  height the river does not need. The world layer behind everything is
  still phase 3's canvas.
- **The ground generator stayed in the atelier.** It serialises through
  `react-dom/server`, which the table should not ship. Nothing at runtime
  needs it yet: phase 3's still tier is the baked file.
- **The picture stays as long as its caption does**, until the next card
  turns, rather than returning to the horizon on the next action. The
  latest discovery stays in view while the next player decides, which is
  how the caption already behaved. One rule: the picture illustrates the
  text.
- **Subjects are still one per category.** Each entry's own seed varies
  the land, but every Clear Path in a setting is the same lit doorway.
  The `subject` vocabulary (lantern, rope, cairn, pack, tracks…) with
  keyword inference is the natural next piece of work, and is listed
  below as 2b.

**Broke / retried.**
- **The deep forest cost a slow phone most of a second per reveal.**
  The other settings cost nothing measurable; the forest's turn was
  +0.84 s of main-thread time at 4× CPU. The model costs under 1 ms; the
  cost was the DOM. At the `wide` frame's density a 6:1 forest grew ~150
  trees, about 600 SVG shapes. Growing feature counts by the square root
  of the extra width instead brought every setting within noise.

  | Setting | Turn, vista on | Turn, vista off |
  |---|---|---|
  | Deep forest | 1.84 s | 2.07 s |
  | Frozen pass | 2.14 s | 1.79 s |
  | Dungeon | 1.65 s | 1.42 s |

  The worst long tasks were 166–167 ms with the vista on and 152–172 ms
  with it off. Fewer, larger trees also read better as a forest across a
  whole screen.
- **An escaped apostrophe was eaten by a scripted edit** to the atelier's
  bench and broke its compile. It was caught by `tsc` and fixed by hand.
- **`capture-walk.cjs` never took its 2900 ms photograph.** The loop
  stopped just short of it. Fixed.

**Verified.**
- **The atelier's output did not change.** With the atelier serving from
  `packages/art`, `node scripts/bake-art.cjs` re-baked all twelve pictures
  **byte-identical**: git saw no change. Every atelier bench loads with
  no console errors.
- **Full crossings.**
  - New board, frozen pass: 202 reveal samples over 15 reveals, **0px**.
    Each reveal's vista and caption were photographed.
  - Old board, dungeon: 182 over 13, **0px**.
- **Cost.** `buildScene` takes 0.04–0.97 ms per scene at 4× CPU across
  the six settings, so idle-time pre-generation is not needed. The bundle
  grew 7.4 KB gzipped.
- `npm run typecheck`, `npm test` (11) and `npm run build` are clean in
  `apps/table`. `apps/atelier` builds.

**Commit:** `git log --grep world/2`.

### 2b — subjects, for later

A small vocabulary of subjects in `packages/art/src/scene.tsx` would let
each picture show *this* scene rather than its category's doorway. Each
subject is a sprite like the existing seven: lantern, door, stair, cairn,
rope, pack, tracks, water, flame, boulder, two figures. `TableEntry` would
get an optional `subject`, inferred from keywords when it is absent ("a
lantern that burns without fuel" → lantern). The keywords can live with
the tables, and the sprites can be judged on the atelier's Scene bench
before the table uses them. The seed is the entry, so adding a subject
changes one picture and no others.

### world/3 — the world layer

**Changed.**
- **`world/renderer.ts` (new)** is one WebGL2 canvas with two programs.
  It uses no library.
  - **The ground** is a full-screen triangle: the setting's ink, two
    layers of slow fog, the pool of the setting's light (breathing, as
    the SMIL grounds did, at their opacities), paper grain and a
    vignette.
  - **The air** is a single draw of points: dust, motes, sand, drips,
    snow or embers, with the grounds' counts, sizes and colours. Every
    particle's path is a function of time and four random numbers,
    computed in the vertex shader, so nothing is uploaded after the
    setting is chosen.
  - **The main thread's work per frame** is easing a handful of numbers
    and setting about a dozen uniforms. Constants go only when the
    setting, the size or a flash colour changes.
- **`world/World.tsx` (new)** owns the canvas, the loop and the tier.
  The mood is read off the **presented** view, so the world moves when a
  beat lands:
  - the light leans quietly towards the river or the hand, whichever
    the phase is about; the focus element is measured a few times a
    second, not every frame;
  - a turned card's colour washes out from it and goes;
  - threat draws the vignette in and warms its edge;
  - *through* raises gold, and *lost* puts the light out;
  - on desktop the fog and the air shift a few pixels with the pointer.
- **Tiers** (`world/settings.ts`). Each device remembers its choice, set
  from *Atmosphere* in the GM drawer:

  | Tier | What it draws |
  |---|---|
  | Full (`high`) | 1.25 device px per CSS px, full air |
  | Light (`low`) | half resolution, fewer particles |
  | Still | one frame whenever the mood changes, never a loop |
  | Off | the old animated ground |
  | Auto | starts Full, or Light on a phone; see below |

  - **Auto** steps down when the median frame over 120 frames or two
    seconds runs past ~45 fps.
  - **WebGL drawn by the CPU** (SwiftShader, llvmpipe) goes straight to
    Still.
  - **Reduced motion** is always Still.
  - **No WebGL2, or a lost context**, leaves the old ground.
  - **The loop pauses** when the tab is hidden.
- **While the world is live, the old ground under it is dropped**
  (`.t-app:has(.t-world[data-live])::before`): a covered SMIL picture
  still costs its re-rasterising. The landing page, the campaign screen
  and the old board keep the SMIL ground. The player's screen gets the
  world in phase 8.
- `measure-frames.cjs` takes `--world`, `--gpu` (this machine's GPU
  instead of SwiftShader) and `--dpr`. Its floor row now means nothing
  behind the table at all: world off and old ground stilled.
  `capture-walk.cjs` takes `--world` and `--gpu`.

**Design notes.**
- **The world reproduces the old grounds before it adds anything.** The
  same ink, pool, grain, air and vignette, in the same proportions, so
  switching to it costs nothing in look. Side by side with *Off* at
  1600 × 1000 they are hard to tell apart in a still frame. The
  difference is that this one moves with the game, and costs a third as
  much.
- **The focus light is deliberately faint** (5% at its centre). The
  ledge already says where to look, and feel/9b's lesson was that a
  loud persistent indicator irritates. The world's lean is meant to be
  felt.

**Broke / retried.**
- **Headless Chromium draws WebGL in software.** The first measurement
  said the world kept the main thread busy for the whole 4 s window at
  9 fps. A probe of `WEBGL_debug_renderer_info` showed SwiftShader. With
  `--use-angle=d3d11` the same browser reports this machine's GPU (an
  RTX 4070 Ti), and the cost falls to a fraction. Every number below
  says which renderer it was taken on.
- **The budget script emulated a phone's 3× density at every size.** So
  its "1600 × 1000" was a 4800 × 3000 screen composited in software. On
  that evidence the software-GL fallback was briefly set to the old
  ground. Re-measured at 1× it was the wrong call — Still beats the old
  ground there on every count — and it was set back. `--dpr` now exists
  so this cannot happen silently.
- **Auto took thirteen seconds to step down** at 9 fps, because it judged
  every 120 frames. It now also judges every two seconds.
- **Still redrew on every render of the table**, dozens a turn. It now
  redraws when the mood changes (threat, progress, the outcome, the
  focus).
- **The grain read as television static.** It is halved.

**Verified** (headless Chromium, 4× CPU).

*The budget, on the GPU, at 1600 × 1000, 1×:*

| Setting | World Full, idle | Nothing behind, idle | Old ground, idle | Turn, Full | Turn, old ground |
|---|---|---|---|---|---|
| Frozen pass | 0.28 s | 0.16 s | 0.75 s | 1.66 s | 1.91 s |
| Deep forest | 0.30 s | 0.16 s | 0.78 s | 1.59 s | 1.99 s |

The target was **at most 0.35 s** per 4 s idle. It is met, at about
40% of the old ground's cost.

*At phone width* (390 × 844, 3×, GPU, Auto → Full): idle is 0.27–0.34 s,
against a floor of 0.14–0.18 s. A real phone starts on Light (coarse
pointer).

*On software GL* (1600 × 1000, 1×):

| | Idle | One turn |
|---|---|---|
| Auto → Still | 0.14–0.17 s | 1.49–1.88 s |
| Old ground | 1.21–1.25 s | 2.52–2.99 s |

Both drop 18–27 long frames in a turn; that is software compositing,
whatever is behind the table.

**Also verified:**
- **Every tier compiles and draws** in all six settings. There are no
  console errors beyond headless's own "GPU stall due to ReadPixels",
  which comes from the screenshot readback.
- **Auto** stayed Full on the GPU and went to Still on SwiftShader.
- **The drawer control** switches Off, Still, Light, Full and Auto live,
  and remembers the choice. Off brings the old ground's drift back.
- **Reduced motion** gives Still, and the page asked for no animation
  frames in a second.
- **A reveal's colour wash and the lost ending's darkness** were
  photographed on the GPU.
- **Full crossings.** New board, tower: 179 samples over 11 reveals,
  **0px**. Old board, desert: 228 over 14, **0px**.
- `npm run typecheck`, `npm test` (11) and `npm run build` are clean.
  The bundle grew 7.3 KB gzipped.

**Owed to the author** — this ends the first slice:
- **Look at it moving, on a real screen.** No headless frame can show
  fog drifting or snow falling.
- **One look on a real phone**, still owed from phase 0.

**Commit:** `git log --grep world/3`.

### world/4 — decide on the table

**Changed.** On the new board no decision is a dialog any more, except
the two that must block (the roll and the encounter), and those grew to
the size of the moment. Every decision still sends the engine's own
payloads; nothing in `packages/rules` changed.

- **Wanderer.** The card stands up in its slot — lifted, lit in its
  colour — with *They stay* / *They move on* on its foot. Its scene
  stays visible above. This is the decision the analysis found worst
  served: the old dialog blurred out the Wanderer and the scene it is
  narrated from.
- **Careful Consideration.** The two turned cards stand up, with *Strike
  the left* / *Strike the centre* on each.
- **Scout Ahead.** The three drawn cards rise off the deck pile — each
  animated in from the pile's top card — and fan over the river, which
  steps back. The chosen card flies back onto the deck.
- **It's Elementary.** Two steps. The drawn cards fan over the river; the
  chosen one is held up off the deck, and every river slot offers *Put
  it in the left / centre / right*. The card flies into the slot it
  replaces, and *Choose the other card* goes back a step.
- **Boost Morale.** The party rail lights up, and a seat is the choice.
- **The prompt.** What is being decided, and who decides, sits where the
  hand would rise; the hand sinks further to make room. It is a
  `role="status"` live region, so it is announced.
- **The roll** (`components/RollStage.tsx`) is still the centred,
  blocking Radix dialog of feel/3b, restaged as D3 decided:
  - the card being attempted is lifted beside the die — the action's
    own ability card, or the Obstacle;
  - the die is about three times its old size;
  - the DC is a mark on a line that the total runs up to, falling short
    of it or clearing it, after the die lands;
  - the verdict washes the world's light as well as the panel, through a
    new `onLanded` on `DieRoll`: the Obstacle's green for a success, the
    Monster's red for a failure.
- **The encounter** (`components/Encounter.tsx`) is a takeover, not a
  box:
  - the threat light floods in from the edges, with the world's threat
    pushed past its two-strike maximum;
  - the vista and the caption above still show the Monster that found
    the party;
  - *Roll initiative* is set large, with the three outcomes under it.

  It is still a blocking dialog: focus held, Escape and outside clicks
  refused.
- **Shared pieces.**
  - `SlotLayer` lays a box over a river card. Work-on-it now uses it
    too.
  - `CardFan` is the drawn cards.
  - `Ghosts` flies a card from where a decision was made to where it
    went. The stage cannot see these moves: a face-down card replaced by
    another face-down card is invisible to it, by design. The dispatch
    goes at once, and the ghost only shows it.
- **Keyboard.**
  - Each decision takes focus as it opens: the first fanned card, the
    first slot button, the first seat.
  - When a decision closes, its control goes with it. Focus is then
    handed on to what is owed next — a path to pick, or the first
    action.
- `capture-walk.cjs` drives in-place decisions: it reads the prompt's
  title, then presses *They move on*, the first offered choice, or a
  lit seat.

**Design notes.**
- **The fan goes over the river rather than beside the deck.** Beside
  the deck there is no room at any size; over the river, three cards are
  readable at the river's own size, and the river is not what is being
  decided while a fan is up. For It's Elementary's second step the fan
  goes away and the river comes back, because then the river *is* the
  decision.
- **The success colour is the Obstacle's green**, as it already was on
  the old roll's total and panel wash, not the Clear Path's gold.

**Broke / retried.**
- **The takeover repeated the Monster's scene line**, which the caption
  above already shows through the transparent top of the overlay. It
  was removed.
- **Two shell blocks were refused before they ran**, a CSS heredoc and a
  docs update; nothing was half-written. Both went through files and the
  Edit tool instead.

**Verified** (headless Chromium; decisions on the GPU with the world at
Full).
- **The six on-table decisions**, photographed: Wanderer, both steps of
  It's Elementary, Careful Consideration, Scout Ahead, Boost Morale.
  Also the restaged roll on a failure (14 short of the DC 15 mark, in
  red) and the encounter takeover.
- **Scout Ahead.** Focus opened on the first fanned card. Choosing
  launched one ghost, and the log read *"Item goes on top of the deck"*.
  Focus then went to a river card.
- **Boost Morale.** Focus opened on the first seat. **Enter** on it gave
  Sable the advantage dot.
- **Reduced motion.** The same decisions work, with no ghost flights,
  and focus is still handed on.
- **Full crossings.**
  - New board, desert: 13 prompts answered in place, and 175 reveal
    samples over 15 reveals at **0px**.
  - The GPU walk in the tower: 235 over 16, **0px**.
  - Old board, deep forest: 176 over 14, **0px**. Its dialogs are
    untouched.
- `npm run typecheck`, `npm test` (11) and `npm run build` are clean.
  The bundle grew 3.1 KB gzipped.

**Not yet seen by the author.** The look of these needs a real screen,
as phase 3's world did. The roll's world wash in particular is behind
the dialog's frosted scrim, and a headless frame cannot show how much of
it comes through.

**Commit:** `git log --grep world/4`.

### world/5 — the world keeps score

**Changed.**
- **The cue (D2, DECISIONS O2), the plan's one engine change.**
  `GameEvent` has an optional `cue` — `jam`, `reshuffle`, `found`,
  `through` or `lost` — on the one log line that marks the moment. It is
  mechanically inert, and it is set only where it marks something, so a
  stored log reads exactly as before. No existing rules test changed.
  `test/cues.test.ts` adds one test per cue, and two that keep them
  honest: every cued line is public (a player's view carries the same
  ones), and no other line carries one. 73 tests.
- **The beats read the cues** on the lines new since the last view
  (`stage/beats.ts`):
  - `jam` — the third blocker lands; then every card in the river goes
    to the discard together, a card the table never saw going as a
    back; then `feed`, the Monster from outside the deck, brought in
    from beyond the right edge onto the discard; then the deal.
  - `reshuffle` — the discard gathered back onto the deck, five cards
    seen to go for the pile, just before the deal that needed it.
    Around a jam it can fall either side of the sweep, and the
    discard's count at the end says which.
  - `found` — the strike lands, then a 1.5 s beat in which the dark
    closes in, then the encounter.
  - `turn` carries the new `round` when it wraps the table.
  - While a jam or a reshuffle plays, each card is counted onto the
    discard as it lands, rather than the pile jumping to its final
    count with the first — which, after a reshuffle, is empty.
- **The stage has `flights`**: several cards in the air in one beat.
  `StageOverlay` draws them on all three screens, so the old board and
  a player's phone get the jam and the reshuffle too.
- **The route** (`components/Route.tsx`) replaces the escape pips in
  the top rail: the threshold, a waypoint for each Clear Path, the far
  side. Each one gained pins a landmark — the card's own doorway with
  that scene inside it, seeded by the entry, so it is the vista's scene
  in the card's frame — and the party's light rides the line to it. The
  light travels by a transform in container units (`cqw`), never by
  `left`. Arriving, the landmark rises out of the line and a ring of
  light goes out from it. It is a meter to assistive tech, as the pips
  were. Threat stays the pips: the plain readout.
- **The chronicle.** `campaign.chronicle` keeps every scene drawn this
  crossing, with its round, its seat and the ground already gained. It
  is app state beside `prompt`, cleared with each crossing. The route's
  landmarks are read from it, and phase 7's storyboard will be. It is
  keyed by the pick's log line, because an encounter starts the turns
  again inside the same round.
- **The vista steps forward** when ground is gained: the picture scales
  8% into the doorway at its foot over 1.8 s, and holds until the next
  scene replaces it. A transform on the picture, never on the table.
- **The dark** (`world/renderer.ts`, `world/World.tsx`). With each
  strike the vignette draws in further and reaches in, in slow
  tendrils rather than a ring; the light cools and reddens; and each
  setting brings its own shapes to the edge. One strike short of being
  found, the air slows to 30%: it runs on its own clock, so it slows
  without a jump. Ground gained thins the fog and widens the pool a
  little. All of it is behind branches on uniforms, so a board with no
  strikes skips it outright.

  | Setting | What comes to the edge |
  |---|---|
  | Dungeon | eyes between the pillars, red-amber; the torchlight gutters |
  | Tower | the candles gutter; a pair of eyes above |
  | Deep forest | the dark reaching in like roots, full of gold eyes |
  | Desert | a wall of blown sand closing in |
  | Undercity | small red eyes, low down, many of them |
  | Frozen pass | frost creeping over the edge; pale eyes keeping pace |
- **Found.** For the found beat and the encounter, a dark layer
  (`.t-table::before`) fades in over the board's own edges while the
  world's threat floods past its two-strike edge. The takeover waits
  for the beat: it opens on the *presented* phase.
- **Round marks.** *Round 2* passes over the river for two seconds as
  the turn that wraps lands, with a low bell, and is announced through
  a status region.
- **Sound** (`stage/sound.ts`): a slam for the jam, a riffle for the
  reshuffle, a low swell for being found, a bell for the round. All
  synthesised, all silent unless sound is on.
- **Scripts.**
  - `capture-score.cjs` (new) stages each moment — the route, the
    round, the jam, the reshuffle, being found, the dark — by
    rewriting the saved run so it is one pick away, then photographs it
    as it plays and fails if a moment never appears. `--reduced` checks
    that nothing moves under reduced motion; `--board=session` runs it
    on the old board.
  - `measure-frames.cjs` has an *idle at one strike* row and `--rows`.
  - Both capture scripts now print React's warnings with their
    arguments filled in. The key in a duplicate-key warning was being
    cut off.

**Design notes.**
- **The round mark passes over the river, not the caption.** Over the
  caption it struck through the scene being read. Nobody is choosing
  from the river as a turn begins, and the mark is gone in two seconds.
- **The dark is quiet at one strike and loud only when found.** One
  strike darkens and reddens the edges and lets an eye open now and
  then; the persistent picture stays a mood, which is feel/9b's lesson.
  The found beat is the moment that gets to be loud.
- **The eyes keep to the sides**, where the table is not, and low where
  a setting's idiom says so.
- **The jam sweeps what the table can see.** A card the engine dealt
  face down into the jam's own refill, and swept at once, is not drawn
  arriving and leaving: its slot shows empty, and the deal fills it.

**Departures from the plan, and why.**
- **"The vista's horizon steps forward" is the picture stepping into
  the scene.** After the first card the vista always shows the latest
  scene, never the horizon at rest, so a horizon that advanced would
  almost never be seen.
- **The route's landmarks are the card's doorway, not a crop of the
  vista.** At 24px a doorway with a lit scene inside reads; a strip of
  landscape does not. Same seed and subject as the vista's picture.
- **`found` is a beat; `through` and `lost` are only cues so far.** The
  ending's beats still come from `useEnding`. The cues are there for
  phase 7.

**Found on the way.**
- **Scout Ahead re-dealt the whole river.** Three cards leaving the deck
  with no slot to show for them looked like a sweep to `plan()`'s
  deck-count reasoning, so every scout dealt the river again, face down
  over face down. Cards a decision holds off the table now explain
  themselves (test added).
- **A reload mid-reveal drew a new scene** for the same card. It is now
  read back from the chronicle.

**Broke / retried.**
- **The Monster never flew in onto an empty discard.** The feed beat
  starts in the same tick the jam's cards land, before React has drawn
  them on the pile, so there was no card there to measure. It measures
  the pile's empty place, which is the same size.
- **A reshuffle hid the card that left.** The discard ends empty, so the
  discard's growth said nothing had gone to it. With a reshuffle in
  play, one card gone is one card discarded, and of several only the
  one just taken is taken to have left.
- **A duplicate React key, in some crossings.** The round mark and the
  discard pile are siblings, keyed by the round and by the pile's count:
  in Round 2 with two cards in the discard, both were `2`. The mark's
  key is prefixed, and capture-score's round scene now stages exactly
  that case. Reproduced with the old key; gone with the new.
- **A backtick in a GLSL comment** closed the shader's template string.
- **The browser pane runs no layout observers while hidden**, so the
  vista could not be measured there. It was measured through
  capture-score instead: the stepped picture stays inside the vista's
  box, under its faded edges.

**Verified** (headless Chromium).
- **capture-score, GPU, 1600 × 1000, dungeon.** Every staged moment
  appeared, with no console errors: the route's arrival and the vista's
  step; the round; the jam at 2.2 s and its Monster at 2.9 s; the
  reshuffle; found at 3.3 s and the encounter 1.5 s after it.
- **The dark in every setting**, at one strike and when found,
  photographed on the GPU (`proof/score-<setting>`).
- **Reduced motion.** Nothing flies, the round is marked without
  moving, and the encounter opens with the truth (1.9 s, at the reveal
  timer) rather than after the dark.
- **The old board.** The jam and the reshuffle fly there too. A full
  crossing in the desert: 182 reveal samples over 16 reveals, **0px**.
- **The new board.** A full crossing on the frozen pass: 169 over 15,
  **0px**.
- **The route at 1024 × 768, 1366 × 768 and 600 × 900.** Narrower than
  1100px it takes a row of its own under the run's name.
- **The budget**, GPU, 1600 × 1000, 1×, 4× CPU, against HEAD served from
  a worktree beside it, so both columns come from the same session:

  | | HEAD (`world/4`) | `world/5` |
  |---|---|---|
  | Idle, world Full | 0.30–0.33 s | 0.29–0.34 s |
  | Idle at one strike | — | 0.29–0.37 s |
  | Nothing behind | 0.17–0.18 s | 0.17–0.18 s |
  | One turn, mean of 9 | 2.34 s | 2.43 s |

  The dark costs the main thread nothing: idle at one strike is idle.
  The turns differ by 4%, inside the ±0.25 s their runs scatter by.
  Turns run higher than phase 3 measured (1.6–1.7 s), but HEAD shows
  the same rise, so it predates this phase.
- `npm test` in `packages/rules` (73) and in `apps/table` (19),
  `npm run typecheck`, `npm run build` and the API's typecheck are
  clean. The bundle grew 4.3 KB gzipped, and the CSS 1.0 KB.

**Not yet seen by the author.** The air slowing, the eyes opening and
blinking, the tower's candles guttering and the tendrils shifting are
all motion, which no headless frame shows.

**Commit:** `git log --grep world/5`.

### world/6 — cards with weight

**Changed.**
- **Tilt** (`useTilt.ts`). The card under the pointer tilts towards it,
  up to 8°, with the point under the pointer pressing away from the
  viewer. The hook only says where the pointer is over the card: `--tx`
  and `--ty`, −1 to 1, written straight onto the card element at most
  once a frame, so the board does not re-render per move. The
  stylesheet does the rest. It runs on the river and both piles, for a
  fine pointer only, and never under reduced motion.
- **A card's pose is now parts.** Whatever lifts a card on the new
  board — the hover over a path that can be taken, a card a decision is
  about, a press — sets `--t-lift` and `--t-scale`, and one transform,
  `--t-pose`, puts them together with the tilt. A lifted card can tilt
  too, and nothing overwrites anything.
- **The sheen.** A band of light crosses a face-up card as it tilts: a
  gradient far larger than the card, moved by a transform inside the
  trim's rounded clip.
- **Backs in depth.**
  - `packages/art` can draw one depth of a picture (`ScenePart`: `sky`,
    `far`, `near`). The far and near layers are on a transparent ground,
    with the fade mixed into their colours, since a rect laid over them
    would fill the gaps.
  - The atelier's back bench has a *Layer* control.
  - `bake-art.cjs` bakes each back whole, as before, and as its three
    layers: 18 new files under `biomes/art/`.
  - `DeckSkin` in `packages/ui` gained `backLayers?: string[]`
    (additive). `CardBack` draws the layers, back to front, as
    `.md-card__art` images carrying `data-depth`. The library never
    moves them.
  - As a back tilts, the table moves its layers apart: the sky stays,
    the distance moves about 1%, the foreground about 2.4%. Each also
    grows a little, the nearest most.
- **Piles with thickness.** The deck shows its stacked edges below and
  to the right of its top card. They are the library's two plates, made
  the whole card's size, striped, and set out by `--t-thick`, which the
  board sets from the count, so the deck visibly thins as it is dealt
  from. The discard shows the two cards seen to land before its top
  one, lying askew under it (`stage/useDiscardTrail.ts`).
- **Anticipation.** A path being pressed lifts further, towards the
  viewer (16px up, ×1.05). It stays lifted while the pick travels to a
  server (`data-picking`). When the reveal starts, the stage reads how
  the real card stood — its lift, its scale and its tilt — and the
  overlay starts there and settles as it turns (`.t-fly__pose`), so the
  pick no longer snaps the card flat. This part is shared by both
  boards.
- **A signature for each category on the reveal**, on top of feel/4's
  flare. These are on the new board only: `useStage` and `StageOverlay`
  take `signatures`.

  | Category | What it does |
  |---|---|
  | Clear Path | light pours out of the arch up to the route's next waypoint (`.t-beam`, placed by the board), with an airy rise |
  | Monster | red seeps into the dark ahead of its strike (the world's threat, raised for the hold), with a growl |
  | Obstacle | its face comes down hard, and dust billows out from under its foot, with a slam |
  | Item | it turns slowly (900 ms), and a glint crosses it, with a small ring |
  | Wanderer | it stands up, to the pose the river's raised card takes once its decision is on, so the hand-over is seamless |

  The Monster's growl moved from its strike to its reveal, where the
  red seeps in. On the new board the strike that follows is a blow.
- **Scripts.** `capture-weight.cjs` (new) photographs the tilt (a
  back's corner, a face-up card's corner, the deck), the press and its
  release, each category's reveal as frames, and the piles. For each
  signature it also takes one picture with the animation held at its
  height. `--reduced` checks that nothing tilts.

**Design notes.**
- **The layers' growth is also their overscan.** Each layer grows by
  more than twice the most it moves, so its edge never shows. At rest
  the three are exactly the whole back.
- **The discard's under-cards are what this screen watched land.** The
  view names only the top card, so a screen opened mid-crossing shows
  the top card alone, which is all a table would have seen either.
- **The signatures stay off the old board**, which keeps feel/4's
  reveal. The two boards share only the pose carry-over, which removes
  a snap and adds nothing.

**Broke / retried.**
- **Vite served a stale `DeckSkin.tsx`.** The provider dropped the
  layers and the backs had none. Touching the file fixed it. After
  that, every changed module was checked with `curl` before any picture
  was trusted, and files written by scripts were missed twice more.
- **The back's moving layers showed their edges**: a light strip along
  the top, and a seam at the side. The layers now grow as they move
  (see the design notes).
- **The deck had no visible thickness.** The library's plates are the
  trim's size, and they stayed hidden behind the top card's dark bleed
  margin at any offset worth drawing.
- **The dust did not show.** It was drawn behind the card, and too small
  to clear its edges. It is in front now, larger, and longer.
- **The glint's skew poked its corner into the card** before its sweep
  began.
- **Frames taken on the clock miss moments this short.** The script's
  own latency put frames wherever it liked. Holding each signature's
  animation at its height for one picture made it deterministic. The
  beats run on timers, so holding an animation moves nothing.

**Verified** (headless Chromium, on the GPU).
- **The layers are the back.** Stacked, they match the whole picture to
  within 2/255 per channel, with no pixel off by more than 3, in all six
  settings. The twelve existing pictures re-baked byte-identical.
- **Tilt.** The cards took 3D transforms under the pointer, the back's
  layers moved apart (the far layer ~2px, the near ~6px), and the card
  went back to rest when the pointer left. Under reduced motion nothing
  tilted.
- **The press.** Held at ×1.05; the overlay started from that pose and
  was at rest 450 ms after the release.
- **Each signature** was photographed at its height
  (`proof/weight/sig-*-peak.png`) and as frames.
- **The piles** were photographed: the deck full and nearly spent, and
  the discard after three cards had landed.
- **Full crossings.** New board, deep forest: 279 reveal samples over 20
  reveals, **0px**. Old board, tower: 317 over 21, **0px**. Neither had
  a console error.
- **Phase 5's moments** all still play (`capture-score.cjs`), and its
  reduced-motion pass is clean.
- **The budget**, GPU, 1600 × 1000, 1×, 4× CPU, against HEAD served from
  a worktree beside it:

  | | HEAD (`world/5`) | `world/6` |
  |---|---|---|
  | Idle, world Full | 0.22–0.25 s | 0.23–0.26 s |
  | One turn, mean of 12 | 1.27 s | 1.37 s |
  | One turn, worst frame | 100–117 ms | 100–117 ms |
  | One turn, frames over 33 ms | 1–2 | 1–3 |
  | One reveal alone, by category | 0.73–0.97 s | 0.75–1.06 s |

  Idle is unchanged: tilt costs nothing until the pointer is on a card.
  A turn costs about 0.1 s more at 4× CPU, around 8%, and the frame
  pacing is the same. The extra is the reveals' own effects, the Clear
  Path's light and the Obstacle's dust the most (+0.09–0.10 s each).
- `npm test` in `packages/rules` (73, untouched) and in `apps/table`
  (19), `npm run typecheck`, and the builds of the table, the atelier
  and `packages/ui` are clean. `packages/ui`'s emitted `.d.ts` carries
  `backLayers` inline, which is what the design-sync needs. The bundle
  grew 3.3 KB gzipped (the six small sky layers are inlined) and the
  CSS 1.1 KB; the far and near layers ship as twelve asset files.

**Not yet seen by the author.** The tilt and the parallax under a real
hand, and the signatures at the speed of play.

**Commit:** `git log --grep world/6`.

### world/7 — ceremony

**Changed.**
- **The opening.** A crossing just started, whether on one screen or
  hosted, opens with its ceremony on the new board. `App` passes an
  `opening` key on Start and on Host; a resumed or reloaded board does
  not get one. The ceremony runs on MOTION's `open*` moments:

  | From | What happens |
  |---|---|
  | 0 ms | The world starts in the dark and the setting lights up. The crossing's name rises over the horizon, with the setting's name above it and its flavour line below (`components/Opening.tsx`), and a low bell. |
  | 700 ms | The deck is riffled: its top cards split into two packets either side of the pile and come back together, with the riffle sound. |
  | 1700 ms | Three cards are dealt from the deck into the river, with the stage's own deal flights. Each slot's card is hidden until its flight lands. |
  | 2500 ms | The party drop onto the rail one at a time, in initiative order. |
  | 3600 ms | The hand rises, the baton appears, and focus goes to the first action. |

  Any key or pointer ends it at once, with everything on the table, and
  reduced motion never starts it. Screen readers are told the crossing
  has begun.
- **The world starts where it is asked to.** The renderer's first frame
  jumps to the mood instead of easing in from nothing. That is what
  lets the opening start in the dark, and a board reopened at one strike
  is now dark from its first frame.
- **The crossing, told back** (`components/Storyboard.tsx`,
  `story.ts`). The end screen is now a storyboard. After feel/8's
  ending (the river fanning open, or the light going out), it shows:
  - how the crossing ended, and a summary in a line ("5 Clear Paths in
    4 rounds; found once, and won");
  - every scene the GM read out, round by round, each with its picture
    (seeded by the entry, as the vista drew it), the setting's name for
    the card in its colour, who took the path, and which path;
  - what came of an encounter, shown on the Monster that caused it.

  *Copy the recap* puts it all on the clipboard as plain text, to read
  out or to keep for next session. A player's preview shows no scenes:
  they are the GM's, until phase 8 shares them.
- **`story.ts`** is the telling, as pure functions with tests (six of
  them): the chronicle in order and in rounds, every encounter read off
  the log's cues (a `found` line, then a Monster put out of the game, a
  getaway, or the end) and given to the last scene drawn before it, the
  summary clause, and the recap text.
- **The vista no longer crossfades on mount.** It used to draw a first
  picture at a guessed shape, measure its box, and fade to the right
  one: two horizons overlaid, and the opening's title sat right over
  them. The first picture now waits for the box, and simply appears.
- **Scripts.**
  - `capture-ceremony.cjs` (new) photographs the opening as frames,
    skips one with a key, stages a crossing near its end and photographs
    its storyboard, copies the recap and reads it back off the
    clipboard, closes a run from the drawer, and starts one under
    reduced motion. Each of those is a check.
  - `measure-frames.cjs` skips the ceremony with a key in every row,
    and has a row of the opening's own.

**Design notes.**
- **The opening is presentation only.** The run is dealt before it
  starts; the ceremony hides the dealt cards and shows them arriving.
  Nothing waits on it, and any input ends it.
- **An encounter belongs to the scene before it.** The engine's
  `found` line follows the reveal of the Monster that found them, so
  the last scene drawn before that line is the one that caused it. No
  new state was needed for that: the chronicle's keys carry the pick's
  log line.
- **The storyboard's actions are at the top.** The dialog focuses its
  primary button, and a button at the foot of thirty pictures would
  scroll the dialog to the end on open.

**Broke / retried.**
- **The storyboard dialog shrank to two columns** at 1600 wide: the
  dialog takes its content's width, and an auto-fill grid asks for
  little. It is given its full width now.
- **The capture script's start button was ambiguous**: the threshold
  has two *Start the crossing* buttons. It takes the first.

**Verified** (headless Chromium, on the GPU).
- **The opening**, as frames at 250, 950, 1950, 2750, 3150 and 3900 ms:
  the name over a dark horizon, the riffle (six cards), the deal (three
  flights) with the river hidden, the river shown and the seats
  dropping, then all four seats down. At 3900 ms the ceremony was over,
  the hand up and focus on the first action.
- **Skipping.** A key at 700 ms ended it: the river and all four seats
  were showing within 120 ms, and the hand was up.
- **The storyboard**, on a staged crossing of seven scenes over three
  rounds with an encounter won, plus the last Clear Path drawn live:
  *The party is through*, "5 Clear Paths in 4 rounds; found once, and
  won", 8 scenes in 4 rounds, 8 pictures, and the encounter on the
  round-two Monster. The recap read back off the clipboard was correct.
  A run closed from the drawer said *The run is closed*.
- **A real crossing's storyboard**, at the end of a walk through the
  undercity, with every scene drawn live and the setting's own card
  names.
- **Reduced motion.** No opening; the hand was up at once.
- **Full crossings**, through the opening. New board, undercity: 218
  reveal samples over 16 reveals, **0px**. Old board, frozen pass: 223
  over 17, **0px**. No console errors.
- **The vista's step** (phase 5) still plays (`capture-score.cjs`).
- **The budget**, GPU, 4× CPU:

  | | Main-thread task | Worst frame | Frames > 33 ms |
  |---|---|---|---|
  | The opening, 1600 × 1000, frozen pass | 0.53 s | 17 ms | 0 |
  | The opening, 1600 × 1000, dungeon | 0.58 s | 17 ms | 0 |
  | The opening, 390 × 844, dungeon | 0.53 s | 26 ms | 0 |
  | Idle, world Full, 1600 × 1000 | 0.22–0.24 s | 17 ms | 0 |
  | One turn, 1600 × 1000 | 1.34–1.54 s | 117–217 ms | 2–3 |

  The opening's window starts at the click, so it includes mounting
  the board, and drops no frames. Nothing on the turn path changed in
  this phase, and idle and the turns sit inside phase 6's ranges. These
  rows are a reference run, not an A/B.
- `npm test` in `apps/table` (25; 6 new) and `npm run typecheck`
  and `npm run build` are clean. The bundle grew 2.5 KB gzipped, and
  the CSS 1.0 KB.

**Not yet seen by the author.** The opening at full speed, with sound.

**Commit:** `git log --grep world/7`.

### world/8 — windows

**Changed.**
- **The GM can show the table a scene** (DECISIONS O1). The GM's caption
  has a *Show the table* button, level with the kicker and out of the
  flow, so it never moves the river. Pressed, it says *Shown to the
  table*; pressed again, the scene comes back down. The GM drawer has
  *Scenes shown one at a time* / *Every scene shown to the table*, kept
  with the campaign (`autoShare`, off by default): when it is on, each
  scene is shown as it is drawn. Single-screen games have no table to
  show, so neither control appears there.
- **The `share` op** (`api/session/[op].ts`). GM only. It writes the
  scene (`{key, category, entryId, text}`) to a new `scene` column on
  the room row, never to `GameState`. Every view reply carries it beside
  the view. The authority checks that:
  - the key names a pick in this crossing's public log, and the card that
    pick turned;
  - the text is between 1 and 600 characters.

  Sharing the scene already shown writes nothing. `null` takes it down,
  and a new crossing in the room clears it.
- **The migration** (`server/migrations/2026-10-09-maze_sessions_scene.sql`):
  the column, plus a constraint that it is an object of at most 2 KB.
  It was run on the live database on 2026-10-09, after the commit, with
  the author's go-ahead: other apps share that database, so it is never
  run without one. [DEPLOY.md](DEPLOY.md#migrations) says how. The authority checks for
  the column before writing it. Without it, *Show the table* answers
  *"needs the database migrated first"*, and hosting and play are
  unchanged. So the code can ship first.
- **One more mark on the log.** A pick's line now carries `turned:
  {slot, category}`. The card is face up for everyone by then, so the
  mark is public, and it is additive like O2's cues. One rules test is
  new (74). It exists because of what broke below: a phone that polls
  can miss a reveal entirely, and the log is the one thing it cannot
  miss.
- **The phone is a window now** (`screens/PlayerScreen.tsx`, rewritten,
  and `phone.css`). One column, phone first. From the top:
  - the setting and round, your name, and a status line that always
    says whose move it is (*Your turn — choose an action*, *Your roll —
    throw, and tell the GM*, *Your turn — commit to a path*, *Odalis is
    rolling*);
  - the route and the threat track;
  - **the vista** of the latest card turned. Once the GM has shown its
    scene, it is that scene's picture, the same one the GM's board drew.
    Until then it is the card's own picture, seeded by the card;
  - **the scene**: the card's name in the setting's terms and colour,
    then the GM's line once shown, or *The GM has the scene*;
  - the river and the piles, scaled to fit;
  - somebody else's roll, if there is one;
  - the party with the baton, the log folded away, and Sound, Haptics
    and Leave.
- **A sheet at the foot, under the thumb.** On your turn the hand of six
  rises into it, three across, large targets. Once you have chosen, your
  roll takes its place: the die as it landed, or, when the table rolls
  its own dice, a die to throw. Otherwise the sheet is below the edge
  and inert.
- **The throw** (`components/Throw.tsx`). Tap it or flick it, and it
  tumbles and lands; with advantage, two dice and the better kept. *Tell
  the GM: 19.* The GM still types the result in, and that is the roll
  the room acts on. The phone then shows the GM's number in place of
  its own. One throw per check.
- **Haptics** (`stage/haptics.ts`), where the device has them:
  - your turn, `40·60·40`, once per turn;
  - a Clear Path, a light tick (14 ms);
  - a strike, a long buzz (260 ms);
  - the jam, `70·50·70`;
  - being found, `90·70·90·70·320`;
  - the die landing, 30 ms.

  On by default, with a toggle that each device remembers.
- **The world layer at `low`** on a phone. A coarse pointer already
  started there (phase 3); the phone gets the same mood as the board:
  threat, progress, the hush, the flash on a reveal, and focus on the
  hand on your turn.
- **Scripts.**
  - `local-session.mjs` (new) runs the real authority against an
    in-memory stand-in for the table, with `--app` for a copy of the app
    pointed at it and `--unmigrated` for a table without the column. No
    secrets, and never the live database.
  - `check-share.mjs` (new) checks the op against it.
  - `capture-phone.cjs` (new) plays a hosted game from both sides, a GM
    at 1600 × 1000 and a phone at 390 × 844 with touch and its vibrations
    recorded, and checks each step.

**Design notes.**
- **The phone reads the log, not the reveal.** It learns of a turned card
  from the last `turned` line, keyed as the GM's chronicle keys it (the
  pick's line and the slot). A scene the GM shows is matched to its card
  that way. A stale one, for a card before the latest, is not shown.
- **A short grace before the picture changes.** A scene shown at once
  arrives a round trip after its card turns. The phone waits 900 ms
  before it draws the card's own picture, so with automatic sharing it
  goes straight to the GM's picture instead of drawing two in a row.
- ***The GM has the scene*, not *is reading it*.** A phone may first
  learn of a card after its turn is over, and a GM may tell the scene
  aloud and never show it. The line stays true in every case.
- **The throw is ceremony.** Its number stays on the phone and goes
  nowhere. Nothing a player's device decides reaches the engine.
- **No verdict on the phone.** It shows the total against the DC, and
  the verdict is the GM's to give, as in phase 4.

**Broke / retried.**
- **The phone missed reveals.** Locally there is no Realtime, so the
  phone polls every six seconds, and the GM resolved an Obstacle (which
  stays in the river) inside one poll. The phone never saw the reveal
  phase, so it never knew a card had turned, and a scene shown later
  had nothing to match. Production rings Realtime on every change, but
  two quick changes still fold into one fetch. The fix is `turned`, on
  the log. The choreographer has the same blind spot, older than this
  phase: a client that skips a reveal's version plays no flip for it.
  Not fixed here.
- **"Waiting on Brakka", to Brakka**, while their own roll was waiting
  for the GM. The status now reads the pending check.
- **Your own roll was off the bottom of the screen** at 390 × 844, under
  the river. It moved into the sheet, where the hand was.
- **The screen still wore `.t-play`**, whose rules make two columns from
  900 px. The phone rules that were worth keeping (the shake, the
  bloom, touch) were carried into `phone.css`.
- **The river sat on a slab** of the deck's ink. The board passes
  `t-river__ground` (transparent), and the phone now does too.
- **The thrown die's corners covered the kicker** and the modifier. A d20
  stands on its point, so its corners reach past its box. It is smaller
  now, with room around it.
- **The turn buzzed twice** in development, from React's double effects.
  It is keyed by round and turn now, so nothing fires it twice.
- **The script's own mistakes**, for the record:
  - a join link fills in the code but still waits for *Join*;
  - the GM's board draws a control a beat after the state allows it, so
    pressing at once missed;
  - the waiting die sways, so Playwright never thought it stable;
  - two regexes lost their backslashes passing through a shell.

**Verified** (headless Chromium, against `local-session.mjs`).
- **`capture-phone.cjs`, the app rolling:** every check passes. The phone
  joins by code and takes a seat. It knows a card turned and shows *The
  GM has the scene*; the GM shows it, and the phone reads the same line
  within a poll. On the phone's own turn the hand rises, and the turn is
  felt once. The roll rises where the hand was. The GM lets it land, the
  phone is asked for a path, and its pick turns the card on the GM's
  board. With every scene shown as drawn, the next scene reached the
  phone with nobody pressing anything. The vibrations along the way:
  a tick, the turn, a strike.
- **`--manual`:** the phone threw a 6, the GM typed it in, and the phone
  showed the GM's 6 with *Your roll — the GM is ruling on it*. That run
  was found on the way, and the phone felt it.
- **`--manual --gpu`:** the world started at `low` and stayed there (in
  software it steps down to `still`). A 19 thrown and typed in.
- **`check-share.mjs`:**
  - against the migrated stand-in, 12 checks: a player refused, a scene
    from no pick refused, one for a path nobody took or a card that was
    not turned refused, an essay refused, a repeat writes nothing, the
    scene never inside the view, taken down, and cleared by a new
    crossing;
  - `--unmigrated`, 4 checks: refused with the reason, and a new
    crossing in the room still works.
- **Full crossings, both boards:** new board, 149 reveal samples over 13
  reveals, **0px**; old board, 162 over 12, **0px**.
- Rules tests 74 (1 new). App tests 25. Both typechecks (app and
  `tsconfig.api.json`) and the build are clean. The bundle grew 2.4 KB
  gzipped, and the CSS 1.1 KB.
- **Not measured:** the phone's frame budget. `measure-frames.cjs`
  drives the board, not a hosted phone.

**Not yet seen by the author.** A real phone in a real room: its
vibrations, the flick, Realtime instead of polling.

**Commit:** `git log --grep world/8`.

### world/9 — sound as a bed

**Changed.**
- **Each setting has its own air** (`stage/bed.ts`), synthesised in
  WebAudio like the voices, with no files:

  | Setting | The bed |
  |---|---|
  | Frozen pass | Wind: a roar that gusts, and a whistle in it now and then |
  | Tower | A milder wind, and a bell a long way off, struck every 18–40 s, inharmonic as a real one is |
  | Dungeon | A low room tone, and drips answered by a long room (a 3.8 s reverb) |
  | Undercity | Water running somewhere below, and torches crackling close by; a drip now and then |
  | Deep forest | Leaves moving in gusts, and three crickets, each with its own pitch, place and patience |
  | Desert | A high hiss of sand, and gusts |

  The rooms are impulse responses made from seeded, decaying noise, and
  every event is drawn from a seeded generator. Events are laid down a
  second ahead on the audio clock, so a busy main thread never makes the
  bed stutter.
- **It moves with the mood the world draws** (one mood, many layers). The
  board and the phone hand it the same `mood` their world layer gets:
  - threat narrows the filter and brings in a low pulse, a lub-dub from
    the first strike that quickens to being found. A triangle an octave
    up lets a laptop's small speakers carry it;
  - one strike short, the setting's layers thin and their wandering
    stills, as the world's air slows;
  - the far side opens it (the filter and a high shelf);
  - through, it opens further and a warm chord comes in under it;
  - lost, it goes out with the light. The opening starts it in the dark,
    and it comes up with the light.
- **The voices duck it.** Every voice played (a flip, a slam, the dread,
  the bell, the roll) pushes the bed down for a moment and lets it back
  up. `sound.ts` tells listeners which voice played; `bed.ts` decides how
  far and for how long.
- **The threshold asks once** (DECISIONS O6). The first time the
  threshold opens on a device, a card at its foot asks *Play with
  sound?*, with *Sound on* and *Not now*. Either answer is kept, and it
  never asks again. *Sound on* is the gesture that unlocks audio, so the
  chosen door's air starts at once, and choosing another door changes it.
- **One switch, as before.** The GM drawer's *Sound* (and the phone's)
  now covers the bed too. A phone plays its own bed only if its owner
  turns sound on.
- **A screen that takes a bed over keeps it.** From the threshold to the
  board, the same setting's bed carries on instead of starting again,
  jumping to the board's first mood (the opening's dark) as the world's
  first frame does. Leaving a screen waits a moment before stopping the
  bed, so the next screen can claim it.
- **A reloaded page's audio wakes on the first tap or key.** A browser
  keeps a context made without a gesture suspended, and with sound
  already on there was nothing to wake it.
- **A hidden page goes quiet.** The bed fades out, and stops laying down
  events, while the page is hidden.
- **Scripts.**
  - `capture-sound.cjs` (new) renders every setting and every mood
    offline, measures them, writes them as WAV files, and then checks the
    live bed in the app.
  - Every capture script now answers the threshold's question, *off*, as
    part of its setup.
  - `measure-frames.cjs` has `--sound`.

**Design notes.**
- **The graph builds on any `BaseAudioContext`.** That is what lets
  `renderBed` render it on an `OfflineAudioContext`, at any length, with
  moods changing at set times and voices ducking it, deterministically.
  A bed that cannot be listened to in a headless browser can still be
  measured.
- **The mapping is pure.** `bedParams(mood)` gives the level, the
  texture, how much it wanders, the cutoff, the air, the pulse and the
  warmth, and it is tested on its own (six tests).
- **Quiet, under conversation.** Each setting at rest renders at −31 to
  −38 dBFS RMS, with peaks no higher than −15 dBFS. The voices peak
  around −16 dBFS.
- **Not on the old board.** It has no mood to give, and phase 10
  retires it.

**Broke / retried.**
- **At the far side the cutoff was already at its ceiling**, so there was
  nothing left for coming through to open. The unit test caught it. The
  resting cutoff came down from 9 to 7 kHz.
- **Opening the sound barely moved the pass** (a centroid of 482 → 502
  Hz). Its wind sits below 2 kHz, where a 6 kHz shelf hardly reaches. The
  shelf is at 2.5 kHz now (482 → 565 Hz).
- **The dungeon and the undercity sounded alike** once their hums were
  lifted into a range small speakers play: 0.08 apart in octave profile.
  The undercity got running water instead, which is truer to a sewer.
  The closest pair now is the pass and the tower, 0.38 apart.
- **Stillness was measured with the pulse in it.** The pulse beats harder
  in the hush and hid the wind going still. Measured above 250 Hz, the
  wind moves 0.80 dB against 2.92 dB.
- **The live checks read a fresh copy of the module.** After a hot
  reload Vite serves the app's `bed.ts` at a `?t=` address. The script
  imports the address the page actually loaded.
- **Handing the bed from the threshold to the board rebuilt it**, and
  the check read the bed's target rather than what was heard. The bed
  now carries over (above), and `bedNow()` reports the live gain.
- **The question's card was translucent**, and the sample cards behind
  it ghosted through. It is opaque.
- **Every capture script would have met the question.** On a phone-sized
  threshold its card sits over the doors. They answer it now.

**Verified** (headless Chromium).
- **`capture-sound.cjs`, offline:**

  | Setting, at rest | RMS | Peak | Centroid |
  |---|---|---|---|
  | Frozen pass | −32.4 dB | −16.9 dB | 482 Hz |
  | Tower (30 s, with the bell) | −33.9 dB | −17.1 dB | 658 Hz |
  | Dungeon | −37.0 dB | −23.2 dB | 117 Hz |
  | Undercity | −37.7 dB | −24.7 dB | 726 Hz |
  | Deep forest | −33.5 dB | −20.3 dB | 2800 Hz |
  | Desert | −30.9 dB | −14.8 dB | 1281 Hz |

  - **No two alike:** the closest octave profiles differ by 0.38. The
    same seed renders the same samples.
  - **Threat:** the centroid falls 482 → 441 → 143 Hz (calm, one strike,
    found), and the energy under 120 Hz rises 8.4% → 13.3% → 68.7%.
  - **One short:** the wind moves 0.80 dB against 2.92 dB.
  - **The far side:** 482 → 565 Hz. **Through:** the chord's band 44.7% →
    63.7%. **Lost:** −33.2 → −87.5 dB.
  - **A voice ducks it:** −36.5 → −46.1 dB under the dread, and back to
    −33.7 dB.
- **`capture-sound.cjs`, live:** the threshold asks, and nothing plays
  until it is answered. *Sound on* starts the chosen door's air with the
  audio running, and another door changes it. A reload does not ask
  again, and its first touch wakes the audio. The board takes the same
  bed over, cut into the opening's dark (heard at 0.23), and it comes up
  with the light (0.99). The opening's voices ducked it twice. The GM
  drawer's switch stops it. *Not now* is kept, silent, and not asked
  again. 36 checks.
- **The WAVs** are in `proof/sound/` to listen to: each setting at rest,
  the pass in every mood, and a crossing on the pass in 42 seconds (calm,
  ground gained, a strike, one short, found, lost).
- **Full crossings, both boards:** new board, 123 reveal samples over 9
  reveals, **0px**; old board, 187 over 13, **0px**.
- **The phone,** against `local-session.mjs`: `capture-phone.cjs`, all
  17 checks.
- **The budget**, GPU, 1600 × 1000, 4× CPU, sound off and on:

  | | Off | On |
  |---|---|---|
  | Undercity, idle | 0.20 s | 0.21 s |
  | Deep forest, idle | 0.19 s | 0.22 s |
  | Undercity, one turn (three runs) | 1.16–1.27 s | 1.21–1.44 s |

  A turn with sound on costs about 0.1 s more on average, the voices
  included, and that is within the spread between runs. No frames lost
  at idle.
- App tests 31 (6 new). The typecheck and the build are clean. The
  bundle grew 4.0 KB gzipped, and the CSS 0.1 KB.

**Not yet seen by the author.** None of it has been heard by anyone: a
headless browser plays into nothing. The WAVs are the way in, and then
the board, with sound on, in each setting.

**Commit:** `git log --grep world/9`.

### world/10 — retire and record

**Changed.**
- **One board.** `TableScreen` is the GM's board.
  - `screens/SessionScreen.tsx` and `components/CheckPanel.tsx`, which
    only it used, are deleted.
  - `App.tsx` no longer keeps a per-device board choice
    (`mazedeck.board`): a stored *session* is ignored.
  - The GM drawer's *Use the old board* is gone.
- **The old board's CSS is gone from `app.css`:** 34 rules, and 11
  selector lists trimmed of the parts that could only match it. Pruned
  with postcss rather than by hand, by dropping every selector that named
  a class no source file uses any more, then reviewed line by line. What
  went:
  - the three-column grid, its one-column collapse and the condensed
    seats inside it;
  - the action strip;
  - the old ending's bloom and dim;
  - the old player screen's two-column layout and touch rules (phase 8
    had already carried what the phone needed into `phone.css`);
  - the GM tag on log lines, and the good/bad roll colours.

  No keyframes were left unused.
- **The phone's last old class:** `.t-play__fit` is `.t-phone__fit`.
- **Comments that pointed at the old board are fixed:**
  - one sent readers to the deleted `SessionScreen`;
  - `table.css`'s header described the deletion as still to come;
  - several said *the new board* as though there were two. Where the old
    board is history that explains a choice ("the old board asked this in
    a dialog"), it stays;
  - two comments cited a `.t-main` that had not existed for a long time.
- **Scripts.**
  - `--board` is gone from `capture-walk`, `capture-score` and
    `measure-frames`, and no script sets `mazedeck.board` any more.
  - `capture-frames.cjs` (phase 0's frame-by-frame watcher) reads
    `.t-table` now.
  - `capture-sizes.cjs` (new) measures the size table, so it can be
    measured again whenever it needs to be.
  - `capture-phone.cjs --measure` measures the phone's frame budget, which
    phase 8 left unmeasured.
- **DECISIONS.md** gains W1–W9, what was decided while building: one
  board; the art package and the `scene` column as built; `turned`;
  migrations by hand on a shared database; the local rehearsal; the throw
  as ceremony; one mood across the layers; haptics on by default. O7 is
  marked delivered, and D9 is noted as still open.
- **STATUS.md is rewritten** from scratch for a reader coming in cold.
  The old one, which had grown into a history of M0 to phase 9, is kept
  whole as `docs/history/status-to-world-9.md`.

**The size table, re-measured** (`capture-sizes.cjs`, the board with a
crossing open). It was measured before the deletion and again after, and
the two tables are identical.

| Viewport | River | Piles | Layout | Scrolls |
|---|---|---|---|---|
| 2560 × 1440 | `lg` | `md` | piles flanking | no |
| 1920 × 1080 | `lg` | `md` | piles flanking | no |
| 1600 × 1000, chronicle shut or open | `md` | `sm` | piles flanking | no |
| 1536 × 864 | `md` | `sm` | piles flanking | no |
| 1440 × 900 | `md` | `sm` | piles flanking | no |
| 1366 × 768 | `md` | `sm` | piles flanking | no |
| 1366 × 657 (a 1366 laptop inside a browser), chronicle shut or open | `sm` | `sm` | piles flanking | no |
| 1280 × 720 | `sm` | `sm` | piles flanking | no |
| 1024 × 768 | `sm` | `sm` | piles flanking | no |
| 820 × 1180 (a tablet, upright) | `sm` | `sm` | narrow: piles under the river | no |
| 390 × 844 (a phone) | `sm` | `sm` | narrow | 569px down, 76px sideways |

It matches world/1's at every size it measured, six phases of vista,
route, scene band and ceremony later: each was given its space inside
the fit rather than on top of it. A phone is not where the GM's board is
used: players have their own screen, and the board's floor is still about
580px wide. D9 is still what a 1366 laptop is missing.

**The budget, at the end.**
- **On world/0's terms** (390 × 844 at 3x, 4× CPU, software GL), against
  the old board's baseline from phase 0:

  | | Idle, world/0 | Idle, now | One turn, world/0 | One turn, now |
  |---|---|---|---|---|
  | Dungeon | 0.63 s | 0.21 s | 1.74 s, 1 long frame | 1.99 s, 8 |
  | Tower | 0.70 s | 0.20 s | 1.90 s, 1 | 2.14 s, 10 |
  | Deep forest | 0.76 s | 0.20 s | 2.13 s, 1 | 2.35 s, 11 |
  | Desert | 0.88 s | 0.20 s | 2.80 s, 5 | 2.19 s, 8 |
  | Undercity | 1.02 s | 0.22 s | 3.01 s, 4 | 2.54 s, 9 |
  | Frozen pass | 1.03 s | 0.20 s | 3.08 s, 6 | 2.38 s, 11 |

  At rest the board costs a fifth to a third of what it did, the finding
  phase 3 set out to fix. During a turn the main thread does about as
  much work as before (more in the light settings, less in the heavy
  ones), but drops more frames over 33 ms: the board's moments (the lift,
  the signatures, the flights, the vista) do more than the old board's.
  This is the GM's board squeezed to phone width at 3x in software, which
  is its worst case and not how it is used.
- **The phone's own screen**, for the first time (`capture-phone.cjs
  --measure`, 390 × 844 at 2x, 4× CPU):

  | | Main-thread task | Worst frame | Frames > 33 ms |
  |---|---|---|---|
  | At rest, GPU (world low) | 0.32 s | 17 ms | 0 |
  | Its own pick (the reveal, the flight, the refill), GPU | 1.15 s | 50 ms | 3 |
  | At rest, software GL (world still) | 0.24 s | 33 ms | 0 |
  | Its own pick, software GL | 1.21 s | 133 ms | 7 |
- **Against the commit before (`world/9`)**, in the same session,
  alternating, GPU, 1600 × 1000, undercity. Idle: 0.37–0.38 s either way.
  One turn: 2.34–2.62 s now (mean 2.48) against 2.21–2.38 s (mean 2.32).
  That lean of 0.16 s is inside the run-to-run scatter, and deleting rules
  can only make style matching cheaper.
- **Caveat: today's machine.** Every absolute number above was measured
  on a busier machine than phase 9's: `world/9` itself measured a turn at
  2.2–2.4 s today, against 1.2–1.3 s yesterday. Compare rows within a
  table, not across days.

**Broke / retried.**
- **The phone script's pick could miss.** It tapped the phone's first
  card, and when that slot held a blocker left face up from an earlier
  turn, the tap did nothing. It now taps a face-down card. Its check had
  also waited for the light to leave the river, which a Wanderer never
  does (the GM's call stays in the river); now the check is that the GM's
  table changes at all: its faces, its deck count or its discard.
- **A race in the phone script.** The phone's poll can land between the
  server's write and the GM's own render, so "the GM's caption says it is
  shown" now waits up to three seconds for it.
- **postcss collapsed long selector lists onto one line** when it trimmed
  them; they were wrapped again by hand.
- **The frame numbers came out at twice yesterday's.** The A/B against
  `world/9` showed the old code equally slow today, so this was the
  machine, not the change.

**Known, and not fixed here.**
- **A client that misses a reveal's version plays no flip for it**
  (world/8 found it). With Realtime on, every change is fetched, so this
  only bites on the polling fallback.
- **The GM's scene is drawn when the GM's own client sees the reveal.**
  On the polling fallback, a player's quick pick can resolve between two
  of the GM's polls, and that card gets no scene. The `turned` mark would
  let the GM draw from the log instead, as the phone already does. This
  is the next thing to fix if hosted games are ever played without
  Realtime.

**Verified** (headless Chromium).
- **Full crossing:** 135 reveal samples over 12 reveals, **0px**.
- **`capture-score`, `capture-weight` and `capture-ceremony`:** all clean.
  The jam, the feed, the reshuffle, being found and the round each played
  on cue, and the ceremony's 10 checks passed.
- **`capture-sound.cjs`:** 36 checks, the board taking the bed over among
  them.
- **`capture-phone.cjs`:** 17 checks, against `local-session.mjs`.
- **`capture-frames.cjs`:** it captured a deal on the board.
- **The size table:** identical before and after (above).
- **The served code:** checked with `curl` against the dev server before
  any capture.
- **Tests and build:** app tests 31, rules tests 74, typecheck and build
  clean. The bundle **shrank** 2.5 KB gzipped, and the CSS 0.65 KB.

**Not yet seen by the author.** All of it, phases 1–10, on a real screen,
a real phone and real speakers. Shipping it is a fast-forward of `main` to
this branch, as `world/3` was.

**Commit:** `git log --grep world/10`.

### Shipped — 2026-10-09

`main` was fast-forwarded to `world/10` (`678673d`) and deployed. Before the
push, a fresh checkout ran `vercel.json`'s install and build exactly, and
typechecked the API. After it, Vercel's commit status reported the
deployment complete, and the live site was checked read-only: the bundle
carries phases 4–10 and nothing of the old board; the API answers; `share`
exists; a single-screen crossing on the GPU revealed 13 cards at **0px**
with no errors; the threshold asks once about sound; and Supabase's
schema-reload trigger is on, so the API sees the `scene` column. No room
was created, so a hosted game has not yet been played live.
