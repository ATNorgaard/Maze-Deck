# Status

Rewritten at the end of every session. If you are resuming cold, read this,
then [DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md).

**Last updated:** 2026-08-24

## Where we are

**M0 complete.** The project is consolidated into this repository and both
pipelines were verified working after the move:

- `cd packages/ui && npm run build` → `dist/index.js` 31.6 KB, `dist/styles.css`
  30.4 KB, types emitted.
- The design-sync converter runs clean, 13/13 components:

  ```bash
  node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules packages/ui/node_modules --entry ./packages/ui/dist/index.js --out ./ds-bundle
  ```

The design interview is finished — every decision is settled and recorded in
[DECISIONS.md](DECISIONS.md). Nothing is waiting on the author.

## Next single action

**Start M1: the rules engine.** In order:

1. Rewrite `packages/ui/src/types.ts` to the canonical deck — 23 cards across
   Clear Path / Obstacle / Wanderer / Item / Monster, with `dead-end` and `trap`
   kept in the union but marked `expansion: true` and excluded from the
   canonical composition. Six abilities: add `steel-yourself` (CON) and rewrite
   all six effect strings to the canonical mechanics. `MAZE_DC` 13 → 15.
2. Check `ArchGlyph` and `AbilityCard` handle the new sixth ability before
   assuming they do — `ArchState` includes every `AbilityKey`, so a missing
   glyph is a real risk. A placeholder is fine; the real glyph is M5.
3. Mirror the counts into `packages/ui/src/styles/tokens.css` (`--md-count-*`)
   and `design-system/tokens.css` (`--count-*`). All three copies must agree.
4. Create `packages/rules` — source-only, its own `package.json` with vitest and
   typescript, no build step, no `dist`.
5. Implement the engine per §4 of [BUILD-PLAN.md](BUILD-PLAN.md), corrected to
   the canonical rules: seeded RNG held in state, `pendingChoice` for the
   multi-step actions, strikes rather than an instant-loss confrontation.
6. Tests: one per ability, one per category, plus property tests over seeded
   playthroughs for the invariants.

M1 needs no browser — `npm test` is the whole verification loop, which makes it
the cheapest milestone to make progress on.

## Watch out for

- **`--md-u` is a millimetre.** Card geometry is physically correct for print.
  Add a size step rather than changing the base unit.
- The deck composition exists in **three** places (`types.ts`, two `tokens.css`
  files) and nothing enforces agreement yet. A parity check is M5 work; until
  then, change all three together.
- Read [.design-sync/NOTES.md](../.design-sync/NOTES.md) before touching the
  sync pipeline. Several of its warnings cost real time to rediscover.
- `docs/BUILD-PLAN.md` predates the interview. Where it disagrees with
  `DECISIONS.md` or `canonical-rules.md`, it is wrong — its lasting value is the
  inventory and the list of prototype bugs to turn into tests.

## Milestones

| | | |
|---|---|---|
| M0 | Repo consolidation | **done** |
| M1 | Rules engine | next |
| M2 | Single-screen GM app | |
| M3 | Scenario tables | |
| M4 | Multiplayer | |
| M5 | Deck and print regeneration | |
