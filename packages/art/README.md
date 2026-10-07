# @maze-deck/art

The deck's procedural artwork, shared by the atelier (`apps/atelier`), which
previews and exports it, and the table (`apps/table`), which draws it live:
a picture for every scene the GM reads out (docs/overhaul.md, phase 2).

Everything here is a pure function of a **setting**, a **style**, a **seed**
and a **palette**, so any picture can be reproduced from its recipe and none
of it is anyone else's work (DECISIONS A7).

| File | What |
|---|---|
| `rng.ts` | Seeded randomness and 1-D noise. Nothing touches `Math.random` except `seedWord`, the dice button's. |
| `biomes.ts` | Each setting's drawing vocabulary (terrain, air, light), and `readPalette`, which reads the real tokens off the CSS. |
| `style.ts` | The four ways a picture is drawn: flat, line, pixel, engraving. |
| `scene.tsx` | A view into the setting: sky lit by a card's colour, a horizon from the setting's terrain, the card's subject. Frames: `arch`, `wide`, `back`, and `vista` — any aspect, for the table. |

Consumed as **source**, like `packages/ui` and `packages/rules`: each app
aliases `@maze-deck/art` to `src/index.ts`. There is no `node_modules` here
and no workspace root (see `.design-sync/NOTES.md`); `react` resolves from
the app, which dedupes it (`resolve.dedupe` in each `vite.config.ts`, and
`paths` for the types in each `tsconfig.json`).

The atelier's other generators — the back tile, the ground, the palette — stay
in the atelier until something at runtime needs them. The ground in particular
serialises through `react-dom/server`, which the table should not ship.
