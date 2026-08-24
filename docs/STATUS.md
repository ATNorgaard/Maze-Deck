# Status

Rewritten at the end of every session. If you are resuming cold, read this,
then [DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md).

**Last updated:** 2026-08-24 (M4 part 2a)

## Where we are

**M0 through M3 complete. A full crossing is playable, and the GM is handed
a line to narrate from for every card the party turns over.**

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

**Part 2b — the server. Next.**

1. Cloudflare Worker plus one Durable Object per session. The DO owns
   `GameState`, runs `mayAct` on every inbound action, and broadcasts a
   per-client `GameView`.
2. `SocketTransport` implementing the same interface. `REVEAL_MS` is already
   shared, so the DO's alarm and the board's animation agree.
3. Session lifecycle: create with a join code, reconnect by `playerId`, and
   decide what happens when the GM's tab closes mid-run.

**Part 3 — the player view.** A different screen with different content: no GM
controls, no scenario prompt, no dice overrides. This is why the board layout
was never tuned for phones.

## Next single action

Start M4 part 2b: the Durable Object. `wrangler` is not yet a dependency —
adding it is the first step, and `wrangler dev` runs the DO locally so this is
verifiable without deploying anything.

## Watch out for

- **Prompts are GM-facing and currently rendered on the shared board.** That is
  correct today because the board *is* the GM's screen. When M4 adds a player
  view, `.t-phase__scene` must not be sent to it.
- **CSS regressions from bulk edits.** The `.t-panel` rules were silently lost
  in an earlier rewrite of the layout section, which is why every panel — the
  modals included — painted transparent. Several follow-up patches then no-opped
  because their anchor text was already gone. If you edit `app.css` by script,
  assert the anchor exists; a `.replace()` that matches nothing fails quietly.
- **The board wants width.** Three `lg` river cards need ~1104px of centre
  column, which with the 320px + 300px side columns means roughly a 1810px
  window. `useFittingSize` steps the river down to `md` then `sm` as the column
  shrinks, so it degrades instead of overflowing. The board's `max-width` is
  1960 specifically so `lg` is reachable at all — at 1800 it missed by 8px.
- **`.design-sync/config.json` `dtsPropsFor.ActionBar` is now stale.** It
  hardcodes the old five-ability union and does not know about
  `steel-yourself`. Harmless today; it will emit a wrong `.d.ts` on the next
  design-sync push. Fix it as part of M5.
- **`ArchGlyph`'s `steel-yourself` glyph is mine, not the design system's.** A
  shield with a chevron, drawn to fit the existing arch. It reads fine at card
  size but it has not been through the design pass the other twelve had — M5.
- The deck composition is written in **three** places (`packages/ui/src/types.ts`,
  `packages/ui/src/styles/tokens.css`, `design-system/tokens.css`). Nothing
  enforces agreement yet; change all three together until M5 adds the check.
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
| M4 | Multiplayer | **parts 1 + 2a done** — redaction, authority, transport |
| M5 | Deck and print regeneration | |
