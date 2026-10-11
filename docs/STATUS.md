# Status

Rewritten at the end of every session. Coming in cold: read this, then
[DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md). Before touching
`apps/table`, read the log at the end of [overhaul.md](overhaul.md), and for
the art, [settings-build.md](settings-build.md).

**Last updated:** 2026-10-11: **the settings are built** (`set/0`–`set/6` on
`front-door`): fourteen settings, each side's approved design as its back,
vista and world, and a side chosen per crossing. Not yet pushed. The overhaul
(`world/10`) is what is live.

## Where we are

**The game is built, the overhaul is live, and the settings are built on a
branch.** A GM runs a crossing on one screen or hosts a room that players
join from their own phones. The server never tells any device what is in the
deck that it should not know.

| | What | Where |
|---|---|---|
| Live | The whole overhaul, `world/10` (`678673d`), shipped 2026-10-09 | <https://maze-deck-six.vercel.app>, from `main` |
| Branch | `front-door`: the designs reviewed, then built as `set/0`–`set/6` | never pushed |
| Database | The live `maze_sessions` table has phase 8's `scene` column (run 2026-10-09). The side rides in the room's state JSON: **no migration** | Supabase, a project shared with other apps |

**What `front-door` adds** ([settings-build.md](settings-build.md) has each
phase's log):
- **Fourteen settings:** the six there were, redrawn, and eight new ones
  (the King's Road, the Mire, the High Road, the Drowned Coast, the Barrow
  Moor, the Ember Hold, the Underdark, the Sunken Jungle), each with its
  words, light, palette, dark and sound bed.
- **A side per crossing** (AJ7), chosen on the threshold and carried to
  every phone: 23 sides in all.
- **Every picture is an approved design** (S1–S12):
  - the backs, baked to PNGs;
  - the vista, live on a canvas, each narration line drawing its card its
    own way (a salt on the design's scatter, and half mirrored);
  - the world, drawn in a worker with the table's mood laid over it on the
    GPU, keeping the luminance budget behind the words itself;
  - *Off*, and the page behind the other screens, the side's still frame
    under a veil.

**Verified** (set/5): every one of the 23 sides starts and draws its world
and vista, at 1600x1000 and on a phone, with no errors; the art check
passes the luminance budget for every side at both sizes; a hosted game
passes every phone check on the GPU; all 52 sound checks pass; and the
frame budget is within noise of the overhaul at rest and in a turn.

## Next single action

**The author plays the branch.** `cd apps/table && npm run dev`, then
<http://localhost:5180>: pick a few doors and both sides, play a crossing
with sound on, and host one with a phone (`node scripts/local-session.mjs
--app`, then <http://localhost:5182>). The contact sheet of all 23 boards is
`proof/set5-all-sides.png` (regenerate with the sweep in settings-build.md,
set/5).

Then a ruling, and a push:
- **The world's light no longer leans to the part of the table in play**,
  nor widens with ground gained: both would brighten behind the words.
- **Pushing `front-door` to `main` deploys it**, the Vercel function
  included, which is what lets a hosted room carry the side to phones.
  Until then a phone on the live site plays the default side.

**Still waiting on the author from before:**
- [front-door.md](front-door.md): the landing, the threshold and the join
  screen, brought up to the board. Decisions F1–F6. The threshold's side
  toggle (AJ7) is the only part of it built.
- **D9**, a size step between `sm` and `md` for laptops with about 657px of
  viewport, which get `sm` today. It is a change to `packages/ui` and its
  design-sync ([overhaul.md](overhaul.md#d9--for-the-author)).

## What it is made of

- **`packages/rules`**: the engine. Pure, seeded, 75 tests.
  `createGame` → `apply(state, action)` → `available(state)`, and `view()`,
  which redacts per viewer. The log carries cues for the moments a board
  plays (`jam`, `reshuffle`, `found`, `through`, `lost`) and, on a pick's
  line, the card it `turned`. A run's `side`, like its biome, is inert: the
  engine carries it and never reads it.
- **`packages/ui`**: the card and component library, the deck's tokens, and
  the design-sync. Read [.design-sync/NOTES.md](../.design-sync/NOTES.md)
  before touching the sync.
- **`packages/art`**: the pictures.
  - `src/paint`: the settings' approved designs, one module per setting
    (`SIDES`, `designFor`, `vistaOf` with a line's seed), and the pixel
    painter they draw with (`px.js`), which redraws only the pixels a
    light touches and takes a salt for a line's variation. 18 tests.
  - The scene generator from a seed, each setting's old vocabulary, and the
    styles: the atelier's and the print deck's.
- **`apps/table`**: the app.
  - The threshold: the campaign, fourteen doors with a side for each, and
    the party. It asks once whether to play with sound.
  - The board (`TableScreen`): the side's world full-bleed behind it
    (`world/`: a worker draws the design, WebGL2 lays the mood over it, in
    tiers), the vista and the scene, the route and the dark, the river with
    its piles, the party rail and the hand. Every decision is made on the
    table, the roll and the encounter happen at its centre, and an opening
    and a storyboard bookend each crossing.
  - The phone (`PlayerScreen`): the vista, the shared scene, a hand that
    rises on your turn, a die to throw, haptics.
  - Under it all, the choreographer (`stage/`), the voices and the bed
    (`stage/sound.ts`, `stage/bed.ts`), and the transports (local, and
    remote).
  - Each setting is a file in `src/biomes/` (the note at the top of its
    `index.ts` says what adding one takes). 45 tests.
- **`apps/atelier`**: where the scene generator's artwork is explored.
- **`api/` and `server/`**: the authority, one Vercel function backed by one
  Postgres row per room, with compare-and-swap on `version` and Supabase
  Realtime carrying only the version. Schema changes live in
  `server/migrations/` and are run by hand.
- **`docs/art-directions/`**: the review page the designs were approved on,
  built from `packages/art`.

## Running it

```bash
cd packages/rules && npm test              # 75 tests, ~12s, no browser
cd packages/rules && npm run simulate -- 2000
cd apps/table && npm run dev               # the board, http://localhost:5180, no backend needed
cd apps/table && npm test                  # 45 tests
cd apps/table && npm run build             # tsc --noEmit && vite build
cd packages/art && ../../apps/table/node_modules/.bin/vitest run   # 18 tests
cd packages/ui && npm run build            # tsup + the CSS flattening step
node scripts/bake-backs.mjs                # every side's back and still frame, from the designs
npx vercel dev                             # app + /api/session/*, http://localhost:3000
node scripts/local-session.mjs --app       # a hosted game against an in-memory table, http://localhost:5182
```

## How the work is judged

A headless browser is the only eye most of this work has had, so each part
has a script that drives it and checks what it can. All need the dev server
(or `local-session.mjs` where noted) and write to `proof/`, which is
gitignored.

| Script | What it checks |
|---|---|
| `capture-walk.cjs` | A whole crossing, photographed, and fails if a revealed card stands off its slot |
| `capture-sizes.cjs` | The size table: the card size each screen gets, and whether anything scrolls |
| `measure-frames.cjs` | The frame budget (main-thread time, long frames); `--gpu`, `--sound`, any size |
| `capture-score.cjs` | Phase 5's moments, staged: the route, the dark, the round, the jam, the reshuffle, being found |
| `capture-weight.cjs` | Phase 6: tilt, sheen, depth, piles, each card's signature |
| `capture-ceremony.cjs` | Phase 7: the opening as frames, skipping it, the storyboard and its recap |
| `capture-phone.cjs` | Phase 8, against `local-session.mjs`: a GM and a phone together; `--manual` for the throw, `--measure` for the phone's budget |
| `check-share.mjs` | The `share` op, against `local-session.mjs` (`--unmigrated` too) |
| `capture-sound.cjs` | Phase 9: every setting's bed rendered offline, measured and written as WAVs, then the live bed |
| `capture-frames.cjs` | A deal, frame by frame |
| `check-deck-parity.mjs` | The deck composition agrees in its three places |
| `check-art.cjs` | The art: the luminance budget behind the words at five sizes (any setting and `--side`), the colour reservation, a thumbnail sheet of every side's back |
| `bench-vista.mjs`, `bench-world.mjs` | What a vista frame and a world frame cost on the CPU, every side |
| `variants-sheet.mjs` | Cards as approved and as five narration lines draw them, side by side |

Frame numbers drift between runs and between days. Judge a change against
the commit before it, measured in the same session, alternating.

## Watch out for

- **Vite's watcher misses writes on this machine.** If behaviour contradicts
  the source, check what is served (`curl localhost:5180/src/App.tsx | grep …`)
  before debugging. Restarting Vite with `node_modules/.vite` removed fixes
  it. After a hot update, the app imports a changed module at a `?t=`
  address; a script that wants the app's own module state must import that
  exact address.
- **The Supabase project is shared with other apps.** Nothing applies a
  migration on its own, and none is run without the author's go-ahead.
  [DEPLOY.md](DEPLOY.md#migrations) records each one.
- **A push to `main` deploys.** Work lives on a branch (now `front-door`)
  for that reason.
- **The world and the vistas draw in Web Workers** (`world/paint.worker.ts`,
  `components/vista.worker.ts`), each loading its own copy of the setting's
  chunk. A world or vista that never shows is first a worker that failed:
  look in the console for its error.
- **Edit CSS by script and assert the anchor exists.** A `.replace()` that
  matches nothing fails quietly; it has cost three regressions. And check for
  a duplicate rule further down before concluding a new one is wrong.
- **A new colour token has to be added to every biome block** in
  `biomes.css` if a setting should be able to move it.
- **The deck composition is written in three places** (`packages/ui/src/types.ts`,
  `packages/ui/src/styles/tokens.css`, `design-system/tokens.css`).
  `check-deck-parity.mjs` fails if they disagree.
- **`--md-u` is a millimetre.** Add a size step rather than change the base.
- **On the polling fallback** (a room without Realtime), a client that misses
  a reveal's version plays no flip for it. With Realtime on, it does not
  happen. The GM's scenes no longer depend on catching the reveal: they are
  drawn off the log's `turned` marks (`apps/table/src/picks.ts`).
- **The Vercel token cannot list deployments** (403). Watch a deploy through
  the commit status Vercel posts on GitHub.
- `docs/BUILD-PLAN.md` predates the design interview; where it disagrees with
  DECISIONS.md, it is wrong.

## Worth a decision from the author, eventually

[reference/balance.md](reference/balance.md): the card game as written cannot
be lost, the Maze DC is nearly inert (a failed action still lets you take a
path), and Forge a Path does not pay for itself in a four-round run. And
Careful Consideration reveals two paths, then shuffles them back face down,
so it only ever removes a bad card and never finds a good one. That is
faithful to the rules as printed, but it may not be what was meant. None of
this blocks anything (O8, D8).

## Milestones

| | | |
|---|---|---|
| M0 | Repo consolidation | done |
| M1 | Rules engine | done |
| M2 | Single-screen GM app | done |
| M3 | Scenario tables | done |
| M4 | Multiplayer, now on Vercel + Supabase | done |
| M5 | Deck and print regeneration | done |
| — | Biomes: six settings | done |
| — | The overhaul, `world/0`–`world/10` | done, and live since 2026-10-09 |
| — | The settings: fourteen, 23 sides, the approved designs, `set/0`–`set/6` | done on `front-door`, not pushed |

## History

- [history/status-to-world-9.md](history/status-to-world-9.md): this file as
  it stood before phase 10. The milestones in detail, the Durable Object era
  and the move to Vercel + Supabase, the feel passes, the atelier.
- [overhaul.md](overhaul.md): the overhaul's analysis, plan and log, phase by
  phase.
- [DEPLOY.md](DEPLOY.md): hosting, secrets, migrations, and the local
  rehearsal.
