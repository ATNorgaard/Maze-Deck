# Status

Rewritten at the end of every session. If you are resuming cold, read this,
then [DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md).

**Last updated:** 2026-09-21 (moved off Cloudflare onto Vercel + Supabase)

> **The host changed.** Everything below that says *Durable Object*,
> *wrangler* or *workers.dev* is history, kept because it is the record of how
> the multiplayer half was built and why it is shaped the way it is. The
> mechanism it describes was replaced on 2026-09-21 — see
> [the migration](#the-move-to-vercel--supabase) at the end of this file, and
> [DEPLOY.md](DEPLOY.md). The *rules* did not move: `packages/rules` is
> untouched except for two comments and the deletion of two dead wire types.

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
cd apps/table && npm run dev   # the board, port 5180 — needs no backend
npx vercel dev                 # app + /api/session/*, port 3000
```

The single-screen GM mode runs entirely in the tab, so 5180 alone is the fast
loop. `vercel dev` is the faithful rehearsal: one origin serving the app and
the authority, exactly as production does. `VITE_SESSION_ENDPOINT` overrides
the origin, for pointing a local app at a deployment.

**Deployed and live: <https://maze-deck-six.vercel.app>** (2026-09-21).
Push to `main` to redeploy. See [DEPLOY.md](DEPLOY.md).

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

**Look at the motion in a real browser.** Every beat in plandoc.md was
verified by DOM state in a hidden pane that renders no frames, so nobody has
yet *seen* a card dealt, a die tumble or the river fan open. `cd apps/table
&& npm run dev`, start a crossing, take an action, pick a path, and tune the
tokens in `apps/table/src/stage/motion.ts` by eye. Then deploy.

Beyond that, worth doing in rough order of value:

1. **Play a real crossing at a real table.** Everything below is a guess until
   that happens; see the balance findings, which say the card game cannot
   currently be lost.
2. **What happens when the GM's tab closes mid-run.** The room survives — it is
   a Postgres row — but players currently just see the board stop. The reveal,
   at least, no longer stalls with it: any client may nudge that.
3. The player view is phone-first but has had no real device testing.
4. Re-enabling Dead End and Trap as a playable expansion — the engine, the
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

## The board's one-column layout

Below 1246px the side columns get `display: contents`, which dissolves their
boxes and hands each panel straight to the grid as its own row. That is what
makes them individually orderable — otherwise the whole left column moves as a
lump.

Two things follow from it:

- **The controls panel is `order: 1`.** Campaign / preview / end-the-run was
  landing between the initiative order and the score tracks, which put the least
  urgent thing on the screen in the middle of the most urgent. It now sits under
  the log, at the bottom of the page. It is tagged `.t-board__controls` for
  exactly this; `:last-child` would have matched the log column's last panel too.
- **Initiative condenses to a row of numbered circles, each with its name
  underneath.** Four stacked seats cost most of a short screen; a circle over a
  name costs a fraction of it. What gets dropped is the detail line — the class
  and the advantage tag — and it is visually hidden rather than removed, so a
  screen reader still reads the whole seat.

  That detail line was the board's **only** sign of who is holding a Boost
  Morale, which is real state: it changes how the next check is rolled. So the
  seat now takes a `t-seat--boosted` class and the circle wears a gold dot on
  its rim. Condensed-only — at full width the text already says "advantage",
  and the dot's `::after` resolves to `none` there.

The seat rules reach into the library's own `.md-seat` markup, which makes this
the **second** place the app knows a component's DOM (the first is `.t-river`'s
reveal masking). Both are read-only.

They are scoped under `.t-board` deliberately: the player's screen uses
`.t-seats` as well, and its Order list keeps its names — that screen is narrow
at every width, so condensing it buys nothing and loses who is who. Checked
against the built CSS rather than the source: all five rules ship as
`.t-board .t-seats …` and no unscoped `.t-seats` rule exists.

Verified at 1000px and 700px: circles on one row, vertical order run-info →
initiative → board → log → controls, river unclipped.

## Biomes — the setting is a campaign dial

A maze is a way from A to B, and A and B can be anywhere. The campaign
screen now has a **setting** panel: six chips — Dungeon, Tower, Deep forest,
Desert, Undercity, Frozen pass — and picking one reskins the whole table.
What moves, and where each piece lives:

| What | Where | How |
|---|---|---|
| The cards' names and rule lines | `apps/table/src/biomes/<id>.ts` | Content. A Clear Path in the forest is a *Game Trail*; the rule is reworded but says exactly the same thing. |
| The palette and the page's light | `apps/table/src/biomes.css` | One `[data-biome="…"] .md-root` block per setting redeclares the design tokens. |
| The card back | `packages/ui/src/CardBack.tsx` | Six field motifs (fret, stair, branch, dune, brick, crystal), chosen by the provider's `skin`. |
| The scenario tables | `apps/table/src/biomes/<id>.ts` | Each setting ships a full original set, 31 lines, obstacle checks included. |
| Which setting a run is in | `RunConfig.biome` → `ViewRules.biome` | A string the engine never reads. It rides the wire so a player's phone reskins too. |

**The library does not know what a biome is.** `MazeDeckProvider` takes a
`skin` — per-category copy overrides and a back motif — through a context
that nested providers inherit, and `DeckCard` / `CardBack` read it. Colour
was deliberately kept out of that prop: the tokens are custom properties,
so a palette is one CSS selector, and the selector is `[data-biome] .md-root`
rather than `.t-app` because the board nests a second provider around its
action bar and that inner `.md-root` would otherwise reset to the dungeon.
That inner provider is now `background="transparent"` for the same reason:
the page carries the setting's light as a gradient, and a solid ink block
sat on it as a rectangle.

**The eyebrow keeps the canonical name.** A card titled *Switchback* still
says *Clear Path* above it in small capitals. That is what keeps the log
(which the engine writes in canonical names), the reference cards and the
rules text legible against a reskinned river — the mechanic never loses its
name, it only gains a local one. The printed deck is untouched.

**Palettes move the ground and tune hues within their family; they never
swap them.** Clear Path stays the only warm gold, Monster the only red,
Wanderer cool and Item held clear of it. The grouping logic in `tokens.css`
is what makes seven cards readable at arm's length; a palette that broke it
would be prettier and worse. The one blocker ramp that moves is Dead End in
the frozen pass, stone to ice-grey, still achromatic.

**Campaign schema is v3.** `biome`, and `tablesByBiome` keyed by setting so
switching and switching back loses nothing; a setting the GM has never
edited reads its biome's defaults through `tablesFor()`, and the first edit
takes a copy through `withTables()`. A v2 campaign migrates with its one
table set filed under the dungeon and any run in progress stamped
`biome: 'dungeon'`. Verified against a real stored v2 campaign.

**Inside a run the setting is the run's own**, read from the view, so the
GM's board and every player agree even if the campaign's dial is changed
mid-crossing. Everywhere else it is the campaign's, so a choice on the
campaign screen lands on the whole page as it is made — the three preview
cards under the chips are the real components, not a mock-up.

Verified in the browser: the campaign page recolours on click and persists;
a new crossing shows *Frozen pass · Round 1*, crystal backs, and a
transparent action bar; the tables editor shows the frozen pass lists and
restores that setting's defaults; and — the one that matters — a player
joining over a real socket from the Worker's own origin, with no campaign
in their storage, received `frozen-pass` from the Durable Object and
rendered the palette, the header and the backs. 66 rules tests, one new:
the biome reaches both viewers and two runs differing only in biome deal
the same deck.

Adding a setting is a file in `biomes/`, a line in `BIOMES`, and a palette
block in `biomes.css`. Nothing else needs to know it exists.

## The campaign screen is a threshold

Redesigned 2026-09-05 from three sketched directions (a hero, a table of
objects, a typographic ledger); the author chose the hero. The crossing's
name is typed straight into a large title over the setting's own card-back
motif and a pool of its light, with the one-line summary and the Start
button under it. The setting is picked from a **strip of doors** — one
tile per biome, each in its own palette, scroll-snapped, with arrows and
faded edges that appear only once the strip overflows, so more settings
can be added without the picker changing. The party is a ruled sheet; the
dials keep their panel, and under them the deck's composition is counted
live, one figure per category, moving with the two extra dials.

The two GM reference cards are gone from this screen. The loop card was
rules of play, none of it a setting (and its last line, "the card is never
named", was the reversed rule); the deck card's only creator-relevant part
was the composition, which the live count now carries. `ReferenceCard`
stays in `packages/ui` for print.

Two things worth knowing:

- **A door wears its own palette inside a page wearing another.** The
  biomes.css rules now also match `.t-door[data-biome="…"]`, setting the
  tokens on the tile itself so they beat what it inherits. The dungeon
  needs its own tile block, since its palette is otherwise tokens.css.
- `MazeField` is exported from `packages/ui` with a `fit="cover"` mode
  that tiles at a fixed 24px instead of stretching the card's ratio. The
  hero and the doors use it; cards are unchanged.

## Game feel — the table has beats now

Eight phases, each one commit tagged `feel/N`, planned and logged in
[plandoc.md](plandoc.md): a choreographer that plays the difference between
two views one beat at a time (`apps/table/src/stage/`), cards dealt from the
deck pile, impact on the reveal, the d20 as an object in a tray instead of a
modal, a baton that slides between seats, synthesised sound (off by
default), ambient light, and an ending. A ninth took the phase signpost
off the board: the section the phase is about is lit instead (`feel/9`).
The play did not change; the rules tests are the same 66.

Two things learned there are worth carrying:

- **Verify what Vite serves, not what is on disk.** A script that wrote one
  file twice got a hybrid served — the first write's imports, the second
  write's markup missing. `curl` the module and grep for the *last* thing
  written; if it is absent, stop the server, delete `node_modules/.vite`,
  start it again.
- **A hidden browser pane renders no frames.** CSS transitions and
  animations freeze mid-way and timers throttle to a second. Motion logic
  is verifiable through DOM state and a `MutationObserver`; the look of
  motion needs the pane displayed or a real browser.

## The atelier — artwork from a seed

`apps/atelier` (port 5181) is a workbench for the deck's artwork, built the
same way as the table: Vite, React, both packages aliased to source, its own
`node_modules`. Everything it draws is a pure function of a **biome**, a
**style** (`flat`, `line`, `pixel`, `engraving`) and a **seed**, so a piece can
be reproduced from its recipe and none of it is anyone else's work (A7).

Four benches, each previewing on the real cards with the real palette read
off `biomes.css` at runtime:

- **Back** — a seamless 24-unit tile (maze walls, maze passages, or a square
  fret; the maze is generated on a torus, which is what makes it seamless).
  Exports the `FIELD` line for `CardBack.tsx`.
- **Scene** — a view through the arch into the setting: a category-lit sky, a
  horizon from the biome's terrain (pillars, stairs, trees, dunes, vaults,
  peaks), the card's subject in front. Drawn on the glyph's 120 × 140 grid.
- **Ground** — the page behind the table; exports a `--t-biome-ground` value
  with the texture tile inlined.
- **Palette** — a new biome's block for `biomes.css` from a cast, with the
  category hues tuned within their families and never swapped.

The benches never write into the library or the table app themselves.
`node scripts/capture-atelier.cjs` writes a contact sheet of the generators'
range into `proof/atelier/` with the Chromium in `.ds-sync` — the browser
pane cannot screenshot reliably, so that is how the output was judged.

**The table wears the atelier's art now.** Two things changed on the second
pass, at the author's direction: the arch glyph and its symbols on the card
face stay exactly as designed, and the scenes went to the card **back**
instead — the setting's horizon across the whole field, no subject, behind
the vignette, frame and seal. `DeckSkin` gained `backArt?: string` (a URL),
`CardBack` draws it as `.md-card__art` in place of the maze when present,
and each biome file imports its own from `apps/table/src/biomes/art/`. The
motif stays as the print deck's back and the fallback. And every biome's
`--t-biome-ground` is now a 2560 × 1440 picture as its top layer, with the
motion **inside the SVG** as SMIL — the pool breathes, snow falls, embers
rise, dust drifts — over the old gradient as a fallback. Verified in headless
Chromium that the SVG animates both as a CSS background and as an `<img>`.

The campaign screen shows the backs too: a setting's door wears its back
picture instead of the motif tile, and the sample cards under the doors now
start with the back. And the board has a **setting switch** in its controls
row, for looking at the settings, not for play: it changes what this one
screen wears (`previewBiome` in App.tsx) and nothing on the wire, and it is
dropped on the way back to the campaign screen.

The deep forest's trees are drawn as standing trees — tiered conifers and
clusters of rounds on trunks, as shapes on a low bank of undergrowth — rather
than a sawtooth height line, which read as peaks. A scene layer can carry
`shapes` now, for anything with an overhang.

All twelve pictures are baked from recipes by `node scripts/bake-art.cjs`
(one seed per biome, in the script). Re-roll a setting by changing its seed
there, never by editing a file under `art/`. Not yet measured: what the
animated ground costs on a phone — the player's screen shares `.t-app`'s
ground. If it stutters, the `animate` recipe flag off gives a still picture.

## Watch out for

- **A new colour token has to be added to every biome block** in
  `biomes.css` if a setting should be allowed to move it. A token declared
  only in `tokens.css` simply keeps the dungeon's value everywhere, which is
  safe but silent.

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
| — | Biomes: six settings, reskinning cards, palette, backs and tables | **done** — verified over a socket |


## The move to Vercel + Supabase

Done 2026-09-21. `workers/` is deleted; the Cloudflare account is no longer
part of this project.

| Was | Is |
|---|---|
| One Worker serving app + sessions | One Vercel deployment serving app + `api/session/*` |
| A Durable Object per join code | A row in `public.maze_sessions` per join code |
| The DO's single thread | `version`, as a compare-and-swap token |
| `storage.setAlarm` | `reveal_due_at`, and a client that may only *nudge* |
| A WebSocket per client, each with its own view | Realtime broadcasts a version; each client fetches its own view |
| Presence from `ctx.getWebSockets()` | Supabase Realtime presence, tracked by the clients |

**What did not change.** `packages/rules` is the same engine, the same
`view()` and the same `mayAct`. `ADVANCE_REVEAL` is still sendable by nobody.
`SessionTransport` is the same interface — `socket.ts` became `remote.ts` and
nothing above the seam noticed, which is the second time that interface has
paid for itself.

**What got better.** Rooms survive a deploy, because they are rows rather than
process state. Redeploying mid-session used to be forbidden.

**What got worse.** An action now costs a round trip to the authority plus a
round trip back for the view, instead of one frame down an open socket. For a
turn-based card game that is invisible, but it is no longer free. And the
Realtime topic is public: anyone with a join code can subscribe to it, or
publish a fake bump. There is nothing on it to steal — that is the point of
sending only a version number — but it is a door the Durable Object did not
have.

### Verified on the real deployment, not just locally

A script drove two clients through the live authority over HTTPS. **23 checks,
all passing:** a room opens; the GM payload carries no `seed`, no `rng` and no
`deck`, only `deckCount: 20`; a player arriving without a seat is answered with
the roster; claiming a taken seat and claiming to be the GM are both refused;
`CONFIRM_CHECK` from a player comes back *"Only the GM can do that."*; and
`ADVANCE_REVEAL` is refused for the player **and the GM** — *"The server
advances the reveal on its own."*

A second script drove a real turn to the reveal phase. **6 more checks, all
passing:** `PICK_SLOT` lands in `reveal`; a nudge before the deadline answers
`early: true` and the card stays up; after the deadline it resolves once, to
`choice`; and a second nudge is a no-op that does not advance the version.

The lockdown was tested rather than assumed: a row holding a seed and a deck
was written directly, and both public keys were refused it. The shipped
browser bundle contains the project URL and the publishable key and **no**
service key.

### The deploy fought back, and it is worth knowing why

Three failures, each of which made *every* function return a bare 500 with
nothing in the body, and all three found by elimination because the API token
could not read runtime logs.

1. **A root `tsconfig.json` with `noEmit: true`.** Vercel reads it to compile
   `api/`, so every function compiled to nothing. It is now `tsconfig.api.json`,
   which Vercel does not read.
2. **Extensionless relative specifiers.** The lambda is ESM and ESM never
   appends `.js`. A probe reading the lambda's own filesystem showed
   `protocol.js` sitting right there while `'.../protocol'` could not find it
   and `'.../protocol.js'` returned its five exports.
3. **No `"type": "module"` at the root**, so `api/` and `server/` were CommonJS
   while `packages/rules` is ESM — `ERR_REQUIRE_ESM` at load. The tell was that
   every probe using a *static* import died and every probe using a *dynamic*
   `import()` of the same files returned 200, because `import()` from CommonJS
   is legal.

All three are recorded in [DEPLOY.md](DEPLOY.md), because all three fail at
module load where the response says only that a server error has occurred.

**Still to verify at a real table:** everything below "Next single action"
still stands. The engine did not change, but nobody has played a crossing on
this host.
