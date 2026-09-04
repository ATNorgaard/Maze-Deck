# Status

Rewritten at the end of every session. If you are resuming cold, read this,
then [DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md).

**Last updated:** 2026-08-24 (M5 complete — all planned milestones done)

## Where we are

**M0 through M4 complete. A crossing is playable on one screen or across
devices, with the GM's board and the players' phones talking to a server that
never tells any of them what is in the deck.**

```bash
cd packages/rules && npm test            # 44 tests, ~10s, no browser needed
cd packages/rules && npm run simulate -- 2000
cd apps/table && npm run dev             # http://localhost:5180
cd apps/table && npm run build           # tsc --noEmit && vite build
cd packages/ui && npm run build          # tsup + the CSS flattening step
```

- **`packages/ui`** — the component layer, unchanged except for the canonical
  deck data. Builds; design-sync converter runs clean at 13/13.
- **`packages/rules`** — the engine. Pure, seeded, 44 tests.
  `createGame` → `apply(state, action)` → `available(state)`.
- **`apps/table`** — the GM's screen. Vite + React, both packages aliased to
  **source** (no workspace root; hoisting breaks design-sync).

Verified in the browser end to end: a run starts with randomised initiative,
all six actions appear, a check can be rolled and confirmed or overturned, the
choice phase renders real cards, an Obstacle stays face up in the river and
offers the "work on what is blocking them" action, and a mid-run reload restores
round, turn, phase, river, deck, discard and log intact.

**The table sees the cards now.** A second design pass reversed the canonical
"never name the card" rule: a committed card is flipped and named to everyone,
and the deck peeks (Scout Ahead, It's Elementary) are public too, because one
player looking at three cards and keeping quiet is theatre. Nothing currently
flows through the GM-only channel, and the viewer toggle was removed for having
nothing left to demonstrate.

`visibility` stays on every event regardless. M3 gives it a real job — the
scenario prompt is the GM's to read before they narrate it — and M4 still has to
strip face-down river categories from a player's payload, which was always the
actual reason it exists.

**The reveal is its own engine phase.** `PICK_SLOT` flips the card and stops;
`ADVANCE_REVEAL` resolves it. In between, the board holds the card face up, the
Escape or Threat track pulses if one is about to move, and a clone flies to the
discard. It advances on a timer with nothing to dismiss.

That timer needs an owner in M4. On one screen the GM's browser does it. Across
devices, either the Durable Object schedules it (an alarm is the clean answer)
or one client is elected — but two clients both dispatching `ADVANCE_REVEAL`
must not double-resolve, so the server has to make it idempotent.

**Scenario tables are live.** `apps/table/src/tables.ts` holds the type, the
default set (six lines per category, three for Monster, two each for the
expansion cards) and the draw. Tables belong to the campaign, so they are
written once and reused every crossing.

When a card is committed to, the app draws a line from that card's table and
holds it under the phase signpost until the next reveal. The draw avoids the
entry used last for that category, so the same obstacle never turns up twice
running. It uses `Math.random`, deliberately **not** the engine's seeded
generator: narration is not game state, and keeping it out of `GameState` means
a campaign's tables never have to be serialised into every run. The cost is that
prompts are not part of a replay.

Obstacle entries carry a suggested ability and a DC written as an **offset from
the Maze DC**, not an absolute number, so raising the Maze DC still scales
everything from one dial. The attempt controls adopt whatever the drawn entry
suggests and stay editable — DECISIONS R6, delivered.

The campaign schema is **v2**, and `migrate()` carries a v1 blob forward rather
than discarding it. Verified against a real in-progress save: the run survived.

## M4 is in parts. The seam, the authority and the transport are done.

**Part 1 — the redaction and the seam. Done.**

`packages/rules/src/view.ts` defines `GameView`: the wire format, and the only
thing a client is ever given. `view(state, viewer)` builds it as an **allow-list**,
so adding a field to `GameState` does not leak it — you have to come here and
let it through.

Three things never leave the server: **the seed, the generator state, and the
deck**. Any one of them lets a client compute every card the party is about to
draw. Counts go out instead of contents.

The redaction is almost **role-independent**, which surprised me and is worth
keeping: a face-down card is hidden from the GM too, because they deal blind
like everyone else. The only thing `viewer.role` gates is the log — and, in the
app layer, M3's scenario prompt.

`availableFor(view)` replaces the old `available(state)`, so "what may I do" is
derived from what a client can see rather than from the truth. The whole
session screen was converted: it contains **zero** references to `GameState`.

Eight tests in `test/view.test.ts` cover it, including the one that actually
matters: two states differing **only** in hidden information produce
byte-identical views. If a secret ever becomes observable, that test fails.

**Still true today: the browser holds `GameState`,** because there is no server
yet — the app calls `apply()` locally and then redacts for display. The seam is
real and tested; the split is part 2.

**Part 2a — authority, protocol and the transport seam. Done.**

`packages/rules/src/authority.ts` answers "may this actor send this action",
taking the **view** so client and server run the same check — the client to grey
a control out, the server to refuse. Only the server's answer counts.

- A player may act only on their own turn.
- `CONFIRM_CHECK` is GM-only. A player who could confirm a check could pass
  every check they failed, which is the single most important rule here.
- `RESOLVE_ENCOUNTER` and `END_RUN` are GM-only.
- The Wanderer's stay-or-go is GM-only; every other choice belongs to the
  acting player.
- **`ADVANCE_REVEAL` is sendable by nobody.** Making it unsendable is what stops
  two clients double-resolving it. The session dispatches it on its own clock
  and `mayAdvanceReveal` guards it, so a late or duplicate timer finds the phase
  moved on and does nothing.

`src/protocol.ts` holds the wire messages and join codes (six characters, no
I/O/0/1, so nothing is confusable read aloud).

`apps/table/src/transport/` has the `SessionTransport` interface and
`LocalSession`, which behaves exactly as the server will: it owns the state,
refuses what `mayAct` rejects, owns the reveal timer, and emits nothing but
redacted views. `App` no longer calls `apply()` — the board talks to a
transport. Swapping in a socket should change nothing above it.

Verified in the browser: previewing as a player and pressing "Let it land" is
refused with *"Only the GM can do that."*, the check stays pending, and the
phase does not move.

**Part 2b — the server. Done, and proven with two live sockets.**

`workers/session/` is a Worker that does nothing but route a join code to its
Durable Object — the code IS the object's name, so two people typing the same
code land in the same room with no lookup table anywhere.

`SessionRoom` is the authority, and deliberately the same shape as
`LocalSession`: owns `GameState`, refuses what `mayAct` rejects, owns the reveal
alarm, and emits only views. **Each socket gets its own view, built for whoever
it belongs to** — there is no shared payload that then gets filtered.

**The seed is generated inside the Durable Object** and never travels. A client
sends a `RunSetup` (the config minus the seed); the room supplies the rest.

Uses the WebSocket **hibernation** API, so an idle room can be evicted between
turns and woken by a message or the alarm without dropping anybody. Socket
identity survives that via `serializeAttachment`.

Run it locally — no Cloudflare account, nothing deployed:

```bash
cd workers/session && npm run dev      # wrangler dev, port 8787
```

Verified against it from a browser with a GM socket and a player socket:

- Neither `"seed"`, `"deck":[` nor `"rng"` appears anywhere on the wire.
- The player sees `deckCount: 20` and three `filled` but unnamed river slots.
- A player sending `CONFIRM_CHECK` gets *"Only the GM can do that."*; acting out
  of turn gets *"It is not your turn."* — and **the GM receives nothing**,
  because the state never moved.
- The full loop `check → pick → reveal → act` reached both clients, and the
  `reveal → act` step happened **with no client sending anything**: that was the
  Durable Object's alarm.

`apps/table/src/transport/socket.ts` is the matching client adapter, with
reconnect and backoff. **It is not wired to any UI yet** — that is part 3.

**Part 3 — the UI. Done.**

*Host online* on the campaign screen opens a room, shows the join code on the
board, and the run is created inside the Durable Object. *Join a maze* takes a
code, or `#/join/CODE` deep-links straight in so a GM can paste a link instead
of reading letters out.

A player joining without a seat is answered with the roster rather than an
error — they cannot know who is at the table until they arrive. Claiming a seat
remembers it against that code, so a reload lands back on the same character.

`PlayerScreen` is a genuinely different screen, not the board with buttons
removed: one column, phone first, and only the controls that are theirs. It
shows a pending roll as `17 vs DC 15 — waiting on the GM`, **never a verdict**,
because the GM can still overturn it.

Verified across two tabs against `wrangler dev`: the GM hosted `5ZNQYE`, a
second device deep-linked in, was offered the real roster, claimed Wren, and
then tracked every action live — 8 log lines in step, no GM controls, no
scenario prompt, and no action bar except on their own turn.

## Running it

```bash
cd workers/session && npm run dev   # the session server, port 8787
cd apps/table && npm run dev        # the app, port 5180
```

In a production build the app uses **its own origin**, because the Worker
serves it: one deploy, one URL, no CORS and nothing to configure.
`VITE_SESSION_ENDPOINT` still overrides either, for pointing a local app at a
deployed server. See [DEPLOY.md](DEPLOY.md).

**Deployed and live: <https://maze-deck-session.andreastorp123.workers.dev>**
(2026-09-03). Redeploy with `cd workers/session && npm run deploy`. See
[DEPLOY.md](DEPLOY.md) — including the one-time Cloudflare dashboard click a
fresh account needs before its first deploy will succeed.

**Part 3 — the player view.** A different screen with different content: no GM
controls, no scenario prompt, no dice overrides. This is why the board layout
was never tuned for phones.

## M5 — the deck, in print. Done.

`design-system/deck.html` was still laying out the old seven-category deck. It
now prints the canonical five; Dead End and Trap keep their designs behind
`?expansion=1` but are not in the 23. Rules text, the six actions and the
reference card all match `types.ts`.

```bash
node scripts/print-deck.mjs                    # print/MazeDeck_PRINT_v4.pdf
node scripts/print-deck.mjs --expansion --guides
node scripts/check-deck-parity.mjs
```

`print-deck.mjs` drives the page with the Chromium already in
`.ds-sync/node_modules` and writes a real PDF, so regenerating the deck no
longer depends on somebody opening a browser and picking the right print
settings. `scale: 1` and `preferCSSPageSize` are load-bearing — any "fit to
page" breaks the 63 x 88mm trim and the cards stop fitting sleeves.

**`MazeDeck_PRINT_v4.pdf`: 13 A4 sheets, 68 cards** — 23 faces, 23 backs, six
actions, two reference cards and a proof sheet. Checked by eye at 110dpi.

**`check-deck-parity.mjs` closes the drift NOTES.md warned about.** The
composition is written three times and cannot be collapsed into one: the print
page reads the numbers out of CSS at runtime with no build step, and the engine
builds the deck from `types.ts`. The check makes them agree or fails — and it
was proven by breaking one on purpose and watching it name the file.

`steel-yourself` has a real glyph now, in both `ArchGlyph` and the print sprite:
a shield with two chevrons, braced but still going forward, because the action
sweeps the river aside rather than defending against it.

The stale `dtsPropsFor.ActionBar` is fixed and **verified through the
converter** — the emitted `.d.ts` now carries `steel-yourself` and `showDc`.
`conventions.md`, which is stitched into the shipped bundle README, no longer
describes a 28-card deck or a Monster as an instant loss.

## Next single action

Nothing is queued. Every planned milestone is done. Worth doing next, in rough
order of value:

1. **Play a real crossing at a real table.** Everything below is a guess until
   that happens; see the balance findings, which say the card game cannot
   currently be lost.
2. **What happens when the GM's tab closes mid-run.** The room survives — it is
   in Durable Object storage — but players currently just see the board stop.
3. **Deploying.** Fully prepared and verified locally — see [DEPLOY.md](DEPLOY.md).
   The Worker now serves the built app as a static-assets binding, so it is one
   deploy rather than two hosts plus CORS. Verified against `wrangler dev`:
   `/` serves the app, `/session/<code>` still reaches the Worker and upgraded
   to a live socket (101), and hosting a room from that single origin produced
   a join code and a running crossing. **All that is left is `wrangler login`
   and `npm run deploy`.**
4. The player view is phone-first but has had no real device testing.
5. Re-enabling Dead End and Trap as a playable expansion — the engine, the
   tokens, the art and the print page all already support them.

## The front page, and Radix

A cold visitor used to land on the campaign editor. `LandingScreen` now answers
what the thing is first, using the real card components so the page is the
product rather than a description of it. Numbers on it are read from the deck
definition. Routing: cold visit to landing, a browser mid-crossing straight to
its run, `#/join/CODE` untouched. The wordmark goes home.

**Radix primitives, no Tailwind and no shadcn.** The `.t-*` CSS keeps doing all
the styling; Radix supplies only behaviour.

The thing that made shadcn the wrong fit is worth remembering: **Radix portals
to `document.body`, and every token lives on `.md-root`.** Anything portalled
out of that scope paints unstyled. `components/PortalHost.tsx` mounts a host
*inside* the provider and every `Radix.Portal` is given it as `container`.
Verified: the open dialog's `.closest('.md-root')` is non-null.

`Modal` is now a Radix Dialog — focus trap, focus restore, the rest of the page
marked inert, background scroll locked. Non-dismissible modals block Escape and
outside clicks via `onEscapeKeyDown` / `onInteractOutside`, which is load-bearing:
a dismissed pending check leaves the board with no way forward. Radix renders
overlay and content as siblings, so `.t-scrim` no longer centres the modal —
`.t-modalLayer` does, and is `pointer-events: none` so a backdrop click still
counts as outside.

`TablesScreen` uses Radix Tabs. Note the tablist itself carries `tabIndex=0` and
every trigger is `-1` until interaction — that is the roving-focus pattern
working, not a bug, and it is better than the five separate tab stops it
replaced. Radix Tabs activates on **mousedown**, so a synthetic `.click()` in a
test will do nothing; drive it with a real click.

## The player's screen fits the device now

Sized from what the viewport can actually do — width, plus `hover` and
`pointer` — and deliberately **not** from the user agent. A phone in landscape,
a tablet, a desktop window dragged narrow and a phone asking for the desktop
site all want the layout that fits, and only one of those is visible in a UA
string.

**The bug this started from:** the player river was hardcoded `size="sm"`, and
three `sm` cards need ~534px inside a column that is 337px on a phone. With
`justify-content: center` the outer cards were simply clipped — measured at
`x = -69`, so a player could not see or tap the left path. On the primary
device for this screen.

`components/ScaleToFit.tsx` is the backstop: `useFittingSize` takes the largest
of the three discrete steps that fits, and below the smallest step ScaleToFit
scales the block proportionally. A transform is right *here* because a phone is
a display surface — the rule against scaling cards protects the print geometry,
and nothing is printed from a player's phone. The alternatives, two cards or a
sideways scroll, both break the one thing the rules are built on: three paths
compared at a glance.

Three things in it are load-bearing and each cost a debugging pass:

- **`transform-origin: top left`, not `center`.** Content wider than the column
  cannot be centred by auto margins — they collapse to zero — so it sits at
  x=0, and scaling about its own centre throws it right by half the overflow.
- **Measure with `offsetWidth`, never `getBoundingClientRect`.** Layout values
  are unaffected by the transform we apply; a rect would feed the scale into
  itself.
- **Hysteresis is not tidiness.** Writing the height back changes the page
  height, which can toggle the window scrollbar, which changes the width by
  ~15px, which changes the scale. That loop hits React's "maximum update depth
  exceeded"; ignoring sub-pixel churn is what breaks it.

The river and the piles scale as **one block**, so a deck pile is never drawn
larger than the paths being chosen between.

At 900px the screen becomes two columns with a sticky aside. `max-width` is
1290: the board column is `max-width - 388`, and an `md` river needs 875, so
anything under 1263 quietly drops back to `sm`. Measured at 1400px wide the
column is 902 and the river sits at `md`, scale 1.

Touch is handled by `@media (hover: none), (pointer: coarse)`: the pickable glow
is always on rather than waiting for a hover that never comes, the lift is
disabled so a tap does not leave a stuck hover state, and buttons get a 44px
minimum.

## The size table is measured now, and the board is retuned

`useFittingSize`'s thresholds were estimates and **all three were low** — `md`
was listed at 831 when a three-slot river measures 873 — so the hook would pick
a step too large for the column and the centred row was clipped at both edges.
They are now measured: **1181 / 875 / 543**, including two pixels of slack for
subpixel rounding. The row scales linearly with `--md-u`, and the three measured
values confirm it: 541 x 1.6129 = 873, 541 x 2.1774 = 1179.

Re-measure after any geometry change with a run open:
`document.querySelector('.md-river').offsetWidth`.

The board's own model turns out to be exact:

```
centre column = width - 620 (sides) - 45 (gaps) - 38 (padding) = width - 703
```

At a 2085px window it predicts 1257 and the board measures 1257.

**The retune was the breakpoint, not the max-width.** 1960 was already generous
— `lg` needs 1181 of centre, so 1884 of board, and 1960 clears it. What was
wrong was the one-column breakpoint at 1180: between 1180 and 1246 the board
stayed in **three** columns with a centre of only ~478px and clipped the river.
It now collapses at 1246, which is exactly `543 + 703`.

Swept and clean at every boundary: 620 one-column `sm`; 1185 one-column `md`;
1250 three-column `sm` with 6px of headroom; 1305 three-column `sm`; 2085
three-column `lg`.

**The hard floor is ~580px of window.** Below that even one column cannot hold
three `sm` cards and there is no smaller step. The GM board has no ScaleToFit
backstop — deliberately, because `CardFlight` measures the river with
`getBoundingClientRect` for its reveal animation and a transform would move
those coordinates under it. A device that narrow wants the player's screen,
which does scale.

Note for anyone testing this in the Claude Code browser pane: **ResizeObserver
does not deliver there**, fronted or not. Mount-time measurement and the window
`resize` listener do. Verify by reloading at the width you care about rather
than by dragging.

## Watch out for

- **Prompts are GM-facing and currently rendered on the shared board.** That is
  correct today because the board *is* the GM's screen. When M4 adds a player
  view, `.t-phase__scene` must not be sent to it.
- **Vite's watcher misses writes on this setup.** Twice now the dev server has
  served a stale module — once producing a `ReferenceError` pointing at code
  that no longer existed, once silently dropping a new prop so a button did
  nothing. If behaviour contradicts the source, check what is actually served
  (`curl localhost:5180/src/App.tsx | grep …`) before debugging the code.
  Restarting Vite with `node_modules/.vite` removed fixes it.
- **CSS regressions from bulk edits — three of them so far.** One rewrite of
  `app.css`'s layout section silently took `.t-panel` (every panel painted
  transparent, modals included) and then `.t-main` and `.t-stack` (the campaign
  screen ran full-bleed with its reference cards adrift at the bottom). Several
  follow-up patches also no-opped because their anchor text was already gone.
  If you edit `app.css` by script, **assert the anchor exists** — a `.replace()`
  that matches nothing fails quietly. And check for a **duplicate rule further
  down the file** before concluding a new one is wrong: `.t-char` was defined
  twice, and the later copy silently won.
- **The board wants width.** Three `lg` river cards need ~1104px of centre
  column, which with the 320px + 300px side columns means roughly a 1810px
  window. `useFittingSize` steps the river down to `md` then `sm` as the column
  shrinks, so it degrades instead of overflowing. The board's `max-width` is
  1960 specifically so `lg` is reachable at all — at 1800 it missed by 8px.
- The deck composition is written in **three** places (`packages/ui/src/types.ts`,
  `packages/ui/src/styles/tokens.css`, `design-system/tokens.css`). Change all
  three together — `node scripts/check-deck-parity.mjs` now fails if you don't.
- **`--md-u` is a millimetre.** Add a size step rather than changing the base.
- Read [.design-sync/NOTES.md](../.design-sync/NOTES.md) before touching the
  sync pipeline.
- `docs/BUILD-PLAN.md` predates the design interview; where it disagrees with
  `DECISIONS.md` it is wrong. The prototype at `design/dc/Maze Deck.dc.html` is
  a reference for *interaction* only — its rules were discarded.

## Worth a decision from the author, eventually

[reference/balance.md](reference/balance.md): the card game as written **cannot
be lost**, the **Maze DC is nearly inert** (a failed action still lets you take
a path), and **Forge a Path does not pay for itself** in a four-round run. None
of it blocks the build.

One more surfaced while playing: **Careful Consideration reveals two paths and
then shuffles them back face down**, so the party cannot act on what they just
learned — it only ever removes a bad card, never finds a good one. That is
faithful to the rules as printed. It may not be what was intended.

## Milestones

| | | |
|---|---|---|
| M0 | Repo consolidation | **done** |
| M1 | Rules engine | **done** — 44 tests |
| M2 | Single-screen GM app | **done** — playable end to end |
| M3 | Scenario tables | **done** |
| M4 | Multiplayer | **done** — verified across two devices |
| M5 | Deck and print regeneration | **done** |
