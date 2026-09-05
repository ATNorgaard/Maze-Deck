# Game feel — the plan and its log

The play does not change. The *feel* of play does: cards get weight, actions get
beats, outcomes land one at a time. The reference points are Slay the Spire and
Hearthstone, and what they actually do is:

- **Every card is a physical object.** It arcs, overshoots a little, settles.
  Nothing teleports.
- **Every action has three beats:** anticipation, impact, settle.
- **Outcomes are staggered** so the eye follows one thing at a time, never five
  things in the same frame.
- **Numbers are never replaced,** they tick or land.
- **The board has idle life.**
- **Sound carries about half of it.**

Where the app stood before this work: one good beat (the reveal — flip, hold,
fly, track pulse) and everything else teleporting. The river refilled from
nowhere, counts jumped, the d20 was a number that appeared, the check was a
modal over the board, the turn passed by a highlight moving, pips filled
silently, the run ended in a dialog.

## Assumptions, where the author had not decided

- ~~The check **leaves the modal for a tray** docked under the phase signpost, so
  the river stays visible while a roll is on the table.~~ **Reversed by the
  author after seeing it: the roll is a centred modal** (`feel/3b`). The die,
  its beats and the verdict wash are unchanged inside it.
- **Sound is in scope**, synthesised in the browser, off by default.
- The reveal beat **may lengthen the server's reveal timer**.

Any of these can be reversed; each is one commit.

## Constraints held throughout

- Transforms and opacity only. Never animate layout. A phone keeps 60fps and the
  print-derived card geometry is never touched.
- Every beat respects `prefers-reduced-motion` and every beat can be skipped by
  an input — a fast GM is never made to wait.
- Two clients animate independently from their own view streams. Neither tells
  the server anything about animation.
- **No engine changes.** The rules tests stay as they are (66).

## Phases

Order of execution: **1, 2, 4, 3, 5, 7, 6, 8.** Each is its own commit, tagged
`feel/N` in the message subject, so any phase can be found and reverted alone.

| # | Phase | Status |
|---|---|---|
| 1 | The choreographer — view diff → beat queue, motion tokens, reduced motion | **done** — `feel/1` |
| 2 | The deck deals — refills fly from the deck pile, counts tick | **done** — `feel/2`, retuned in `feel/2b` |
| 4 | Impact on the reveal — flare, pip pop, threat crack + shake, obstacle thud | **done** — `feel/4` |
| 3 | The roll — the d20 as an object; ~~in a tray~~ back in the centred modal | **done** — `feel/3`, reversed to a modal in `feel/3b` |
| 5 | The turn baton — highlight slides, action bar rises, phone pulse | **done** — `feel/5` |
| 7 | Sound — synthesised, one toggle, off by default | **done** — `feel/7` |
| 6 | Ambient life — torch flicker, haze drift, log lines slide in | **done** — `feel/6` |
| 8 | The ending — a flourish for through, the light going out for lost | **done** — `feel/8` |
| 9 | The light — the phase signpost goes; the board lights the part to look at | **done** — `feel/9` |

### 1. The choreographer

The one structural piece. A layer between the transport's view and the board
that turns the *difference* between two consecutive views into an ordered
queue of beats — picked, revealed, struck, dealt, turn passed — and plays them
one after another instead of letting them all render in the same frame.

Design:

- `apps/table/src/stage/motion.ts` — durations and easings as one set of
  tokens, and `reducedMotion()`.
- `apps/table/src/stage/beats.ts` — `diffViews(prev, next): Beat[]`, pure.
- `apps/table/src/stage/useStage.ts` — holds the queue and a **presented**
  view: the truth with a whitelist of fields (progress, strikes, river slots,
  discard, deck count, turn) *held back* until their beat plays. The board
  renders the presented view; an input flushes the queue.
- Replaces `CardFlight` rather than stacking on it — the overlay measures the
  river, and two animators would fight.

### 2. The deck deals

A refilled slot is dealt face down from the deck pile: a slide with a slight
arc and a small overshoot, staggered per slot. The discard's new top card drops
onto the pile. Deck and discard counts tick rather than swap.

### 4. Impact on the reveal

A revealed card flares its own category light outward. A Clear Path pops a pip
into the escape track with a scale bounce. A Monster cracks a threat pip and
gives the board a short, low shake. An Obstacle settles with a thud and stays
lit. The server's reveal timer becomes the length of this beat.

### 3. The roll

The d20 becomes an object: it tumbles, the face settles, the modifier slides in
beside it, the total lands with a bump. Success or failure washes the panel in
colour before "let it land". The check moves from the modal to a tray under
the phase signpost.

### 5. The turn baton

The active seat's highlight slides to the next seat. The action bar rises in
for the active player and sinks when their action is spent. On a phone, "your
turn" pulses and vibrates.

### 7. Sound

Synthesised with WebAudio, no asset files: a card slide, a flip, a pip tick, a
die tumble, a success chime, a low note for a Monster. Off by default, one
toggle on the board, and off on players' phones unless they turn it on.

### 6. Ambient life

Card light flickers faintly like torchlight, the biome haze drifts slowly, a
hovered card breathes. New log lines slide in and the newest glows for a
moment. Subtle enough to be felt rather than noticed.

### 8. The ending

Getting through: the escape track completes and the river fans open. Being
lost: the light goes out.

## Log

Written as the work happens. Every phase records what changed, what broke,
what was retried, and the commit.

### feel/1 — the choreographer

**Changed.** `apps/table/src/stage/` is new: `motion.ts` (tokens),
`beats.ts` (`plan(prev, next)`, pure), `useStage.ts` (the queue, the
presented view, the card overlay), `StageOverlay.tsx` (the renderer).
`components/CardFlight.tsx` is deleted; the overlay in `useStage` is its
successor and keeps its flip/hold/fly structure. Both screens now render the
river, piles, tracks, seats and signpost from `stage.presented` and take
controls and modals from the truth. Every dispatch goes through `act()`,
which flushes the queue first. `.t-river[data-covered]` takes a
space-separated list of slots (`~=`), since a deal can owe several at once.
vitest was added to the app (`npm test`, 11 tests on the diff).

**Design notes.**
- The presented view is not "the truth minus animation": it is a sequence of
  coherent intermediate views, one per beat, and the last is always the truth
  itself. That is the property the tests protect.
- Dispatch decisions never read the presented view. The action bar can appear
  before the baton has visibly passed; that is deliberate (a fast GM is never
  made to wait) and Phase 5 gives the bar its own rise.
- The Wanderer's "moves on" no longer stages a flight before dispatching. The
  modal closes on the truth and the depart beat flies the card. Simpler, and
  the same code path as every other departure.

**Broke / retried.**
- The redaction hides a face-down card replaced by another face-down card, so
  a *sweep* (Steel Yourself) could not tell that the middle slot was re-dealt.
  Fixed by counting: if the deck shrank by more than the visible changes
  explain, and every remaining face-down slot is needed to explain it, they
  were dealt too. Anything short of "all of them" (It's Elementary swaps one
  of three) is left alone rather than guessed — the wrong slot animating is
  worse than none.
- Careful Consideration turns two cards up, discards one and turns the other
  back down. A naive diff flew both to the discard. The discard only grew by
  one, so the extra "gone" card is a turn-back and is re-dealt instead.
- First browser run: the pip filled at the *end* of the track pulse, so the
  effect preceded its cause. Track beats now apply their state on the beat's
  first frame and hold the queue for the pulse.
- `npx vitest` from `apps/table` picked up a global v4 and ran from the repo
  root, where the `@maze-deck/*` aliases do not exist. Use `npm test`, which
  runs the local v2 against the app's own vite config.
- `Array.prototype.at` is not in the app's ES2020 lib. Indexed instead.

**Verified.** Sampled the DOM every 150ms through a pick on the GM's board:
overlay turned at 40ms and held; the slot's own card flipped face up under the
mask at ~520ms; the server advanced at ~2000ms and the overlay flew for
640ms; the discard count rose as it landed; the threat track pulsed for
900ms; the slot unmasked with the new card. Timing between the turn and the
flight is the server's 2s, which Phase 4 retunes.

**Commit:** see `git log --grep feel/1`.

### feel/2 — the deck deals

**Changed.** The `deal` beat now has a body: for each slot owed a card, a
face-down card is measured off the deck pile's own top card and flown to the
slot — `.t-deal` in `StageOverlay`, driven by custom properties (`--dx`,
`--dy`, `--s`, `--ms`, `--lift`) so one stylesheet rule serves every flight.
The outer element travels on the overshoot curve, the inner one lifts and
comes down (the arc). Flights are staggered by `dealStagger` and the beat
lasts until the last one lands; the dealt cards are removed as the slots
underneath show their own, same place and size, so nothing is seen to
change. The pile grows from the deck's `sm` to the river's size on the way.
`useTicking` makes both pile counts step one unit at a time (capped at
420ms for a reshuffle). The discard wrapper is keyed on its count, so a new
top card remounts it and `.t-drop` plays. The `discard` beat (a forge, a
sweep) now holds the queue for the drop and applies its state on the first
frame, like the tracks.

**Broke / retried.**
- **Vite served a hybrid module.** The patch wrote `SessionScreen.tsx`
  twice in one script. Vite picked up the first write and missed the second,
  so the served file had the deck ref but not the pile markup: no `.t-drop`
  in the DOM, no dealt cards, while `curl` of the module showed only part of
  the change. Exactly the trap `STATUS.md` records. Fixed by stopping the
  server, deleting `node_modules/.vite`, and starting it again. Lesson kept:
  after a scripted edit, `curl` the served module and grep for the *last*
  thing you wrote, not the first.
- **The browser pane is hidden, and a hidden page renders no frames.** CSS
  transitions and keyframes freeze mid-way (a card sat at opacity 0 after
  its mask lifted and looked like a bug), and timers throttle to ~1s while
  the tab is backgrounded, which stretched every beat. None of it is the
  stage's doing. The stage's *logic* is verified through a
  `MutationObserver` that records overlay elements as they mount, with their
  custom properties and attached animations; the *look* of the motion is not
  verifiable in this environment and is left to the author to eyeball on the
  dev server or the deployed build.
- Two verification cycles drew Obstacles, which settle and deal nothing;
  the third drew the third Obstacle and jammed the river, which the diff
  handled (three slots masked, one deal of three) but the stale module hid.

**Verified** (after the restart, observer log): Forge success → `drop+`
with `tDrop`; pick → `fly+`, slot masked; server advance → `fly-` and a
second `drop+` as the card landed; `deal+` with `dx=-83.5 dy=-265.9 s=1
delay=0ms anims=tDealTravel` carrying a card back; 433ms later `deal-` and
the mask cleared. Counts ticked 12→11 and 14→15.

**Commit:** `git log --grep feel/2`.

### feel/4 — impact on the reveal

**Changed.** The held card's wrapper now carries its category class, and a
`.t-flare` mounts behind it as it turns: the card's own light thrown outward
(radial of `--md-cat-glow`, scale .5→1.7, 700ms), delayed half a flip so it
starts when the face is first visible. Track beats: the newest filled pip
pops (`tPop`, 360ms, overshoot) — selected as "the filled pip followed by an
empty one, or the last pip when full" via `:has()` — and the track glows in
its own colour (the threat track's `--t-pulse` is the Monster red, not the
gold it borrowed before). A strike also shakes the board or the phone
(`data-shake`, ±3px, 380ms). A revealed blocker gets a `settle` beat with a
body: the river carries `data-settled=<slot>` for 320ms and the slot's own
card plays `tThud` (1.06 → .985 → 1). The track pulse is 700ms, down from
900. **`REVEAL_MS` is 1800, down from 2000** — flip 520 + flare 700 + a beat
of stillness. It lives in `packages/rules/src/authority.ts` but is
choreography, not a rule; the rules tests do not depend on its value (66
pass unchanged).

**Broke / retried.**
- `MOTION.settle` was already the name of an easing. A duration of the same
  name made the object literal invalid. The duration is `thud`.
- Nothing else. Vite served the last write this time (checked with `curl`
  before trusting the browser).

**Verified** (observer log, two cycles): an Obstacle — `fly+ md-cat-obst`,
`flare+ tFlare delay=260 dur=700`, then `settled+ slot 0 anim=tThud` as the
overlay left. A Clear Path — `fly+ md-cat-path`, the flare, then
`pulse+ Escape pipAnims=.,.,tPop,.,. filled=3 trackAnim=tPulse`: the third
pip, the one that just filled, is the one that popped. The shake was not
drawn in these cycles (no Monster) and rides the same attribute path as the
pulse.

**Commit:** `git log --grep feel/4`.

### feel/3 — the roll

**Changed.** `components/DieRoll.tsx` is new: a die (two under advantage)
that tumbles — `useTumble` cycles random faces with a cadence that slows as
it settles, 650ms, and stops on the real roll, which was decided before it
rendered — then the modifier slides in, the total lands with a bump 160ms
later, and the DC fades in after that. Where a verdict is allowed the total
and the verdict line take their colour last and the panel washes in it
(`.t-tray:has([data-verdict])`, on a half-second delay). The GM's check is
no longer a modal: it is a `.t-tray` under the phase signpost, so the river
stays in view while a roll is on the table. `CheckPanel` and the player's
check panel both use `DieRoll`; the player's passes `verdict={null}`, which
also removes a small lie the old panel told — it coloured the total good or
bad before the GM had ruled.

**Design notes.**
- The tumble is local to the component, not a stage beat. A roll is one
  thing in one place and needs no ordering against the river.
- The buttons are there from the first frame. A fast GM can "let it land"
  before the die has stopped; the animation is never a gate.
- Leaving the modal loses the focus trap. Nothing else on the board is
  actionable during a check (the phase is `check`), so nothing is lost, and
  the manual-roll input keeps its `autoFocus`.

**Broke / retried.**
- `MOTION.settle` collision from feel/4 recurred in spirit: nothing this
  time, but the CSS anchor missed a blank line and the patch had to be
  re-run for the stylesheet alone. Vite served the last write.
- `CheckPanel` kept a `total` it no longer printed; the strict compiler
  refused it.

**Verified** (DOM, hidden pane): on an action the tray mounted with
`tRise`, no modal, river cards visible; the die was `tumbling` showing a
random face (10) with `tTumble`; after landing it read 13 — the real roll
(`Rolled 13, +3, total 16 against DC 15`) — with `tSlideIn` on the
modifier, `tLand@160` on the total, `data-verdict=good` and "Success";
"Let it land" cleared the tray.

**Commit:** `git log --grep feel/3`.

### feel/5 — the turn baton

**Changed.** `components/SeatBaton.tsx` is new: a glow ring positioned over
one seat by its layout box, transitioning `transform` only, that slides to
the next seat when the turn passes. The `turn` beat now lasts `baton`
(320ms) when the seat actually changes, and applies its view — the new
active seat, the new signpost line — as it ends, so the ring arrives first
and the seat's own highlight lands on it. Both the board's initiative list
and the phone's order list carry a baton; the phone's list now reads from
the presented view too, so it moves in step with the board. The action bar
is keyed on the turn and rises (`t-rise`) for each player rather than
sitting there from the last one; a player's own action panel does the same.
When the turn is a phone's own, its header pulses gold and the device
vibrates a short double tap (`navigator.vibrate`, guarded).

**Design notes.**
- The bar rises the moment the truth says `act`, which is *before* the
  baton has slid — the constraint that a fast GM is never made to wait
  wins over strict sequencing here. The ring and the highlight still land
  together, which is the part the eye reads.
- The ring sits under the seats (`z-index` 0 / 1) so it reads as a rim of
  light around the box rather than a plate on top of it. In the condensed
  layout, where seats are transparent circles, it shows as a soft rounded
  glow behind circle and name.

**Broke / retried.** Nothing. The first verification cycle landed on a
Wanderer choice with no turn change; resolving it produced the turn.

**Verified** (observer log): `bar+ t-actions__bar t-rise anim=tRise`, then
`baton translate(0px, 0px) activeSeat=3` — the ring moved while seat 3
still held the highlight — then `seat-active idx=0 name=Odalis` as the
beat ended.

**Commit:** `git log --grep feel/5`.

### feel/7 — sound

**Changed.** `stage/sound.ts` is new: ten voices synthesised with WebAudio
from oscillators and a filtered noise buffer — slide, flip, tick, tumble
(seven clicks that slow), chime, buzz, growl, thud, drop, baton. Every one
is short and quiet; the growl is felt more than heard. `cue(beat)` maps
beats to voices and is called by the stage as each beat starts, delaying
voices that belong to a beat's end (the drop at the end of a flight, the
staggered slides of a deal). `DieRoll` plays the tumble once per roll and
the chime or buzz when a verdict lands. `components/SoundToggle.tsx` is one
button, on the board's controls panel and beside "Leave" on the phone; the
state is remembered per device in `localStorage` and is **off by default**,
so a player's phone is silent unless its owner turns it on. The click that
turns it on is the user gesture that unlocks the audio context, and it
answers with the baton's note.

**Broke / retried.**
- The tumble played four times: once per die hook (two dice share the
  component) and doubled by StrictMode's development-only double effects.
  Moved to one effect per roll, and `play()` now deduplicates the same
  voice within 40ms — nothing on the table legitimately makes the same
  sound twice that fast.

**Verified** (counting WebAudio node creation, since the pane cannot be
heard): toggling on wrote `on` to storage and created 1 oscillator (the
answer); an action created 28 noise sources for the tumble (the bug above,
now 7); a failed verdict created 1 more oscillator (the buzz); toggling off
wrote `off`. No console errors of this session's making.

**Commit:** `git log --grep feel/7`.

### feel/6 — ambient life

**Changed.** The setting's light moved off the provider's `background` and
onto `.t-app::before`: a fixed layer 12% larger than the viewport, painted
with `--t-biome-ground`, drifting ±2.5% over 48 seconds (transform only;
`.t-app` is `isolation: isolate` so the layer sits behind everything and
can never paint over it). `biomes.css` is untouched. Every card face's
light (`.md-card__light`) breathes on a 3.8s cycle, with the second and
third river slots offset so no two pulse in step; the keyframes carry the
library's own centring transform so they do not undo it. A hovered path's
light swells instead (`tBreathe`, 2.2s). Log lines slide in, and the newest
— first, since the log is newest-first — arrives on a bar of gold and cools
over 1.8s.

**Design notes.** All of it is opacity and transform on small elements,
except the drift, which moves one large fixed layer — the cheapest kind of
large motion there is. Nothing here has a duration under two seconds
except the log's entrance; ambient means felt, not noticed.

**Broke / retried.** Nothing.

**Verified** (computed styles): `.t-app::before` fixed, `tDrift 48s`,
carrying the frozen pass's radial; the provider's inline background is
plain ink; the river's face-up card light animates `tFlicker`; the first
log line computes `tSlideIn, tCool` and the second `tSlideIn` alone.

**Commit:** `git log --grep feel/6`.

### feel/8 — the ending

**Changed.** `stage/useEnding.ts` is new: it holds the closing dialog back
for `ending` (1600ms) after the phase becomes `over` — immediately under
reduced motion — and sounds the outcome once (two chimes, or the growl).
Both screens carry `data-outcome` from the presented view. *Through:* the
three river slots fan open like a hand laid down (rotate ∓7°, the centre
lifted, 900ms on the overshoot curve), the escape track glows for 1.6s,
and a gold bloom rises over the whole board on a fixed layer. *Lost:* the
board's columns dim and desaturate over 1.4s and every card's light goes
out. Then the dialog.

**Design notes.** The dialog's frosted scrim would have hidden all of it,
which is why it waits. The wait is the only place in this work where the
player is made to look before they may act, and it is at the end of the
run, where there is nothing left to act on.

**Broke / retried.** Nothing.

**Verified** (DOM): "End the run" set `data-outcome=lost` at once; at
120ms no dialog was mounted, the columns' `transition-property` was
`filter`, and the river's card light read opacity 0; four seconds later
the dialog "The run is closed" was up. The *through* path was not reachable
in the test run (it needs five Clear Paths); its rules are in the same
block and were checked as parsed. A fresh crossing was started afterwards
so the board is left playable.

**Commit:** `git log --grep feel/8`.

### feel/2b — the black blink, after the author's first look

**Reported.** "A draw animation needs to play when a new card is added to
the river from the deck; the UI flickers black for a millisecond and goes
back to normal."

**Found**, by driving a real headless Chromium and capturing frames
(`scripts/capture-frames.cjs`, new — the pane here renders no frames):

- The deal *was* playing: a card lifted off the pile, arced to the slot and
  landed, 450ms. But it was preceded by a **dark hole**. When the picked
  card flew off, its slot was masked (opacity 0 over the river's near-black
  ground) for the whole track pulse — 700ms of nothing where a card had
  been — and only then dealt into.
- On landing, the dealt overlay was removed in the same frame the mask
  lifted, and the slot's own card **faded in from that ground over 120ms**.
  Same on an Obstacle settling. That fade is the blink.

**Changed.**
- The slot's card no longer transitions opacity. The overlay and the real
  card are the same card in the same place; swap, don't fade.
- A departed slot is presented **empty** — the river's own dashed outline,
  "a path is gone" — instead of masked. The deal beat presents the slots it
  is dealing into as empty too (a card turned back down must not sit there
  face up meanwhile). Deal slots are never masked now; `covered` is only
  ever the slot an overlay stands in front of.
- Track beats hold the queue for the **impact only** (pop 360ms, shake
  380ms). The glow runs to completion on its own: the `.t-track` wrappers
  are keyed on their value, so a pip filling remounts the track and the
  glow and pop play on mount. (They also play once when the board first
  appears.) `data-pulse` is gone.
- The deal itself got more air: 480ms, 28px of lift.

**Verified** (frames + DOM log): after the flight the left slot showed the
"Empty" outline with no mask; the deal started 370ms later (the pop), flew
for ~500ms, and the slot showed its card the frame the overlay left.

**Commit:** `git log --grep feel/2b`.

### feel/3b — the roll back in the modal

**Reported.** "The dice roll div needs to be a modal, centred."

**Changed.** `SessionScreen` wraps `CheckPanel` in `Modal` again; `.t-tray`
is gone. The verdict wash moved from `.t-tray:has([data-verdict])` to
`.t-modal:has([data-verdict])`, so the panel still takes the colour once
the die lands. The focus trap, the inert board and the blocked Escape come
back with the modal, which is the right trade for a thing that has to be
answered. Nothing in `DieRoll` changed.

**Commit:** `git log --grep feel/3b`.

### feel/9 — the light, instead of the signpost

**Reported.** "I would like to have this element removed" — the phase
signpost (*Take an action* / *One action, then a path…* / the scene) —
"and then instead highlight which section to pay attention to at a
current moment."

**Changed.** The signpost is gone: `PHASE_TITLE`, `PHASE_NOTE` and the
`.t-phase` box with them. In its place `.t-board` carries `data-focus`,
set from the *presented* phase as the signpost was, so the light moves
when the beat lands and not when the truth does:

| phase | focus |
|---|---|
| act | `actions` — the action strip |
| pick, reveal | `river` |
| check, choice, encounter, over | none — those are answered in a centred modal, which is its own light |

The focus is a halo, not a box: a `::before` on `.t-river` and
`.t-actions`, a gold radial under the section that fades in over 600ms
and breathes on the torch's `tBreathe`. Who is acting was already said
by the lit seat, so the name that trailed the note is not missed.

Two library grounds had to go bare for it. `.md-actionbar` and
`.md-river` both paint ink-900 — the page's own colour, invisible until a
light sits behind them, when each shows as a dark rectangle over the
halo. The app now passes `t-actions__strip` and `t-river__ground` and
sets both transparent; the buttons and the cards keep their own ground.
The `.t-river`/`.t-actions` wrappers are `isolation: isolate` so the
halo's `z-index: -1` puts it under their content rather than under the
board.

The scene line stays, since it is the one thing the GM reads out and
exists nowhere else, as a bare centred `.t-scene` between the tracks and
the river. Reduced motion keeps the light and drops the breathing.

**Verified** (DOM + screenshots at 1440 and 600 wide): on a fresh run
`data-focus="actions"`, the strip's halo at opacity .9 with `tBreathe`,
the river's at 0; after a failed check, `data-focus="river"` and the
halos swap; a Wanderer's choice modal drops the focus; *They move on*
brings it back to `actions` with the baton on the next seat. No
`.t-phase` in the DOM.

**Commit:** `git log --grep feel/9`.

## Returning to any of this

Every phase is one commit whose subject starts with `feel/N`:

```bash
git log --oneline --grep "feel/"
git show <hash>            # what one phase changed
git revert <hash>          # take one phase back out, alone
```

Phases 2–9 all sit on the choreographer (feel/1). Reverting that one alone
brings `CardFlight` back and takes the rest with it; revert the later ones
first if the aim is to keep the beats and lose only the overlay.
