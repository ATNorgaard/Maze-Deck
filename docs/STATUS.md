# Status

Rewritten at the end of every session. If you are resuming cold, read this,
then [DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md).

**Last updated:** 2026-08-24

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

**The hidden-information model is real and tested in the browser.** The
"Viewing as GM / as player" toggle in the session header filters `visibility:
'gm'` events out and hides the discard's top card. Player-side log lines are
renumbered sequentially, because raw engine numbering left gaps and a gap tells
a player exactly how much is being withheld. When M4 adds the network, this
filter moves server-side — it is currently a client-side demonstration of the
right shape, not a security boundary.

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
