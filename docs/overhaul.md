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
| 1 | The new board, beside the old: world / table / rail / hand layers, GM and chronicle drawers, piles flanking the river, behind a toggle | L | 0 | next |
| 2 | The vista: the atelier's scene generator in `packages/art`, rendered live for each drawn entry; the scene set large | M | 1, D5 | |
| 3 | The world layer: one WebGL2 canvas for light, fog and particles per setting, driven by `mood`, with quality tiers; replaces the SMIL grounds | L | 1, D4 | |
| 4 | Decide on the table: Wanderer, Scout, Swap, Consider and Boost in place; the roll restaged; the encounter as a takeover | L | 1, D3 | |
| 5 | The world keeps score: the route, the dark, round marks, the jam, the reshuffle | M | 2, 3, D2 | |
| 6 | Cards with weight: tilt and sheen, back art in depth, piles with thickness, a signature per category on the reveal | M | 1 | |
| 7 | Ceremony: the opening, and the chronicle at the end | M | 2 | |
| 8 | Windows: the phone gets the vista, the shared scene, the hand, a throw, haptics per beat | L | 2, 3, D1 | |
| 9 | Sound as a bed: per-setting ambience, synthesised, moving with the mood | M | 3, D6 | |
| 10 | Retire the old board, re-measure, record what was decided along the way | S | all | |

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
| D2 | One small, additive engine change: a `cue` on `GameEvent` (`jam`, `reshuffle`, `found`, `through`…), so the stage plays what happened instead of inferring it from counts. | **Yes.** It is additive, every rules test stays as it is, and it adds one test per cue. It is the only engine change in this plan. |
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
