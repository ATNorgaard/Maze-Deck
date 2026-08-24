# Status

Rewritten at the end of every session. If you are resuming cold, read this,
then [DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md).

**Last updated:** 2026-08-24 (M2 revised)

## Where we are

**M0, M1 and M2 complete. A full crossing is playable on one screen.**

```bash
cd packages/rules && npm test            # 40 tests, ~8s, no browser needed
cd packages/rules && npm run simulate -- 2000
cd apps/table && npm run dev             # http://localhost:5180
cd apps/table && npm run build           # tsc --noEmit && vite build
cd packages/ui && npm run build          # tsup + the CSS flattening step
```

- **`packages/ui`** — the component layer, unchanged except for the canonical
  deck data. Builds; design-sync converter runs clean at 13/13.
- **`packages/rules`** — the engine. Pure, seeded, 40 tests.
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

## Next single action

**Start M3: scenario tables.** This is the feature that makes the app better
than the cards rather than a copy of them — see DECISIONS A5.

1. Add `tables: Record<CardCategory, TableEntry[]>` to `Campaign` in
   `apps/table/src/campaign.ts`, bumping `SCHEMA_VERSION` to 2 and writing the
   migration from v1 (v1 blobs currently get discarded — see `load()`).
2. `TableEntry` needs at minimum `{ id, text }`, plus optional
   `{ score, dc }` for Obstacles, which is what DECISIONS R6 promised: the
   entry suggests the check, the GM overrides before the roll.
3. Draw an entry when a card resolves, and surface it to the GM as the prompt to
   narrate from. It must come off the **seeded** generator if it lives in engine
   state — otherwise keep it in the app layer and out of `GameState`, which is
   the simpler option and the one I would take.
4. A per-campaign editor screen. Ship a default set written by us — roughly six
   entries per category, two or three for Monster.
5. Wire the Obstacle entry's suggested score/DC into the existing
   `ATTEMPT_OBSTACLE` control, which currently makes the GM pick a score cold.

## Watch out for

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
| M1 | Rules engine | **done** — 40 tests |
| M2 | Single-screen GM app | **done** — playable end to end |
| M3 | Scenario tables | next |
| M4 | Multiplayer | |
| M5 | Deck and print regeneration | |
