# Status

Rewritten at the end of every session. If you are resuming cold, read this,
then [DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md).

**Last updated:** 2026-08-24

## Where we are

**M0 and M1 complete.**

- The project is consolidated into this repo; `packages/ui` builds and the
  design-sync converter runs clean at 13/13 components.
- The deck is canonical: 23 cards, five categories, Maze DC 15, six actions
  including `steel-yourself` (CON). Dead End and Trap are marked `expansion` and
  excluded from the standard deck with their art intact.
- **`packages/rules` is done.** Pure, seeded, no React and no I/O.
  39 tests pass, typecheck is clean.

```bash
cd packages/rules && npm test        # 39 tests, ~8s
cd packages/rules && npm run simulate -- 2000
```

The engine's shape, if you are picking this up cold: `createGame(config)` then
`apply(state, action) -> { state, events }`, with `available(state)` telling the
UI what it may offer. Everything random comes from a seeded generator held in
the state, so a run replays exactly from its seed. Log events carry
`visibility: 'all' | 'gm'` — that is the whole hidden-information model, and the
redaction must happen server-side, never in the client.

## Read before building the UI

**[reference/balance.md](reference/balance.md).** The simulator found three
things worth knowing: the card game as written **cannot be lost** (there is no
loss condition — danger is entirely delegated to the D&D combat), the **Maze DC
is nearly inert** because a failed action still lets you pick a card, and
**Forge a Path does not pay for itself** in a four-round run. None of it blocks
the app. All of it is worth a decision from the author eventually.

## Next single action

**Start M2: the single-screen GM app.** In order:

1. Scaffold `apps/table` — Vite + React 18 + TypeScript strict. Alias
   `@maze-deck/ui` → `../../packages/ui/src/index.ts` and `@maze-deck/rules` →
   `../../packages/rules/src/index.ts` in both `vite.config.ts` and `tsconfig`.
   Deliberately no npm workspace root: hoisting breaks the design-sync build.
2. Wrap the whole app in `MazeDeckProvider`. A component rendered outside
   `.md-root` resolves no tokens and silently paints unstyled.
3. Campaign and run state in `localStorage` under `mazedeck.campaign.v1`, with a
   schema version in the blob from the first commit.
4. The session screen against the real engine: `River`, `ActionBar`,
   `ScoreTrack` ×2, `DeckPile`/`DiscardPile`, seat list, the pending-check panel
   with the GM's confirm-or-overturn, and the event log filtered to what the
   current viewer may see.
5. New UI the prototype never had: the **choice** phase. Scout Ahead, It's
   Elementary and Careful Consideration all stop and ask. `available(state)`
   returns the choice; render one panel per `choice.kind`.

Note `ScoreTrack variant="threat"` counts strikes toward `ENCOUNTER_AT` (2), and
the engine's `encounter` phase is a **pause**, not an ending — the GM resolves
combat at the table and reports back with `RESOLVE_ENCOUNTER`.

## Watch out for

- **`--md-u` is a millimetre.** Card geometry is physically correct for print.
  Add a size step rather than changing the base unit.
- The deck composition is written in **three** places (`packages/ui/src/types.ts`,
  `packages/ui/src/styles/tokens.css`, `design-system/tokens.css`) and nothing
  enforces agreement. A parity check is M5 work; until then change all three.
- Read [.design-sync/NOTES.md](../.design-sync/NOTES.md) before touching the
  sync pipeline.
- `docs/BUILD-PLAN.md` predates the design interview. Where it disagrees with
  `DECISIONS.md` or `canonical-rules.md` it is wrong; its lasting value is the
  inventory and the list of prototype bugs.
- The old prototype at `design/dc/Maze Deck.dc.html` is a reference for
  *interaction*, not rules — its engine implements a ruleset we discarded.

## Milestones

| | | |
|---|---|---|
| M0 | Repo consolidation | **done** |
| M1 | Rules engine | **done** — 39 tests |
| M2 | Single-screen GM app | next |
| M3 | Scenario tables | |
| M4 | Multiplayer | |
| M5 | Deck and print regeneration | |
