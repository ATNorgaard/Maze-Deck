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

- The check **leaves the modal for a tray** docked under the phase signpost, so
  the river stays visible while a roll is on the table.
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
| 2 | The deck deals — refills fly from the deck pile, counts tick | planned |
| 4 | Impact on the reveal — flare, pip pop, threat crack + shake, obstacle thud | planned |
| 3 | The roll — the d20 as an object; the check in a tray, not a modal | planned |
| 5 | The turn baton — highlight slides, action bar rises, phone pulse | planned |
| 7 | Sound — synthesised, one toggle, off by default | planned |
| 6 | Ambient life — torch flicker, haze drift, log lines slide in | planned |
| 8 | The ending — a flourish for through, the light going out for lost | planned |

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
