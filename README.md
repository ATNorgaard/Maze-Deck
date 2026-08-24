# Maze-Deck

Et kortbaseret navigationssystem designet til at transformere labyrint-scenarier
fra statisk DnD "grid-mapping" til en dynamisk, strategisk ressource-udfordring.

A companion app for a live D&D session: it replaces dungeon mapping with a
card-driven travel subsystem. The GM runs a session, players join from a phone
or a laptop and act on their own turn, and the app holds the deck, the hidden
information and the narration prompts.

## Where things are

| Path | What |
|---|---|
| `packages/ui` | `@maze-deck/ui` — the React component layer. 13 components, print-accurate card geometry, design tokens. Built and stable. |
| `packages/rules` | The engine. Pure TypeScript, seeded, no React. **Not built yet — this is M1.** |
| `design-system/` | Static token/component reference and the print pipeline. |
| `design/dc/` | The Claude Design prototype, imported. Reference for interaction, not code to port. |
| `print/` | Generated print sheets. |
| `docs/` | Everything below. |

## Read these first

1. **[docs/DECISIONS.md](docs/DECISIONS.md)** — every settled product,
   rules and architecture decision, plus the build order.
2. **[docs/reference/canonical-rules.md](docs/reference/canonical-rules.md)** —
   the rules the engine implements, and the places the source leaves open.
3. **[docs/STATUS.md](docs/STATUS.md)** — what is done and what the next single
   action is. Rewritten at the end of every session.
4. **[.design-sync/NOTES.md](.design-sync/NOTES.md)** — read before touching the
   design-system sync. It documents several traps that cost real time.

[docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) predates the design interview and is
kept for its inventory and its analysis of the prototype's bugs. Where it
disagrees with `DECISIONS.md`, `DECISIONS.md` wins.

## Build

The component library is standalone — it has its own `node_modules` and there is
deliberately **no npm workspace root**, because hoisting breaks the
design-system sync (see `.design-sync/NOTES.md`).

```bash
cd packages/ui && npm install && npm run build
```

`npm run build` is two steps — `tsup` for JS and types, then
`scripts/build-css.mjs` to flatten the stylesheet. Skipping the second ships
stale CSS.

## Provenance

The mechanics are reimplemented from a published card system credited in
[docs/reference/deck-of-dungeons-v4.1.md](docs/reference/deck-of-dungeons-v4.1.md).
Rules and mechanics are taken; names, wording and art are entirely our own, and
none of the source's material is committed to this repository.
