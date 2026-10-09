# Status

Rewritten at the end of every session. Coming in cold: read this, then
[DECISIONS.md](DECISIONS.md), then
[reference/canonical-rules.md](reference/canonical-rules.md). Before touching
`apps/table`, read the log at the end of [overhaul.md](overhaul.md).

**Last updated:** 2026-10-09, with the overhaul finished (`world/10`).

## Where we are

**The game is built, and the overhaul is finished on its branch.** A GM runs
a crossing on one screen or hosts a room that players join from their own
phones. The server never tells any device what is in the deck that it should
not know.

| | What | Where |
|---|---|---|
| Live | The game through the overhaul's phase 3 (`world/3`) | <https://maze-deck-six.vercel.app>, from `main` |
| Branch | Phases 4–10: decisions on the table, the world keeping score, cards with weight, the opening and the storyboard, phones as windows, each setting's bed of sound, one board | `overhaul`, 9 commits ahead of `main`, never pushed |
| Database | The live `maze_sessions` table already has phase 8's `scene` column (run 2026-10-09) | Supabase, a project shared with other apps |

**Shipping the branch is a fast-forward of `main` to `overhaul`**, which
deploys (see [DEPLOY.md](DEPLOY.md)). It has not been done, because no one has
yet looked at phases 4–10 on a real screen.

## Next single action

**The author plays it.** On a real screen, with sound on, phones in hand:

1. `cd apps/table && npm run dev`, then a crossing in each setting. Look at
   the board (phases 4–7). Listen to the bed (phase 9); the WAVs from
   `node scripts/capture-sound.cjs` in `proof/sound/` are a way in first.
2. A hosted room with a real phone or two (phase 8). On this machine alone,
   `node scripts/local-session.mjs --app` rehearses one against an in-memory
   table, a second browser window standing in for the phone; it listens on
   localhost only. A real phone has to reach the app, so it needs a
   deployment of the branch (a preview, not `main`, which would ship it)
   or a dev server opened to the local network. A preview talks to the live
   `maze_sessions` table, like production does.
3. Then decide: ship (fast-forward `main`), or say what to change.

Also waiting on the author: **D9**, a size step between `sm` and `md` for
laptops with about 657px of viewport, which get `sm` today. It is a change to
`packages/ui` and its design-sync ([overhaul.md](overhaul.md#d9--for-the-author)).

## What it is made of

- **`packages/rules`**: the engine. Pure, seeded, 74 tests.
  `createGame` → `apply(state, action)` → `available(state)`, and `view()`,
  which redacts per viewer. The log carries cues for the moments a board
  plays (`jam`, `reshuffle`, `found`, `through`, `lost`) and, on a pick's
  line, the card it `turned`.
- **`packages/ui`**: the card and component library, the deck's tokens, and
  the design-sync. Read [.design-sync/NOTES.md](../.design-sync/NOTES.md)
  before touching the sync.
- **`packages/art`**: the deck's pictures from a seed: the scene generator,
  each setting's vocabulary, the styles. The table draws with it live; the
  atelier draws with it on its benches.
- **`apps/table`**: the app.
  - The threshold: the campaign, the doors, and the party. It asks once
    whether to play with sound.
  - The board (`TableScreen`): the setting full-bleed behind it (a WebGL2
    world in tiers), the vista and the scene, the route and the dark, the
    river with its piles, the party rail and the hand. Every decision is
    made on the table, the roll and the encounter happen at its centre, and
    an opening and a storyboard bookend each crossing.
  - The phone (`PlayerScreen`): the vista, the shared scene, a hand that
    rises on your turn, a die to throw, haptics.
  - Under it all, the choreographer (`stage/`), the voices and the bed
    (`stage/sound.ts`, `stage/bed.ts`), and the transports (local, and
    remote).
- **`apps/atelier`**: where the artwork is made and judged.
- **`api/` and `server/`**: the authority, one Vercel function backed by one
  Postgres row per room, with compare-and-swap on `version` and Supabase
  Realtime carrying only the version. Schema changes live in
  `server/migrations/` and are run by hand.

## Running it

```bash
cd packages/rules && npm test              # 74 tests, ~12s, no browser
cd packages/rules && npm run simulate -- 2000
cd apps/table && npm run dev               # the board, http://localhost:5180, no backend needed
cd apps/table && npm test                  # 31 tests
cd apps/table && npm run build             # tsc --noEmit && vite build
cd packages/ui && npm run build            # tsup + the CSS flattening step
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
- **A push to `main` deploys.** The overhaul lives on its branch for that
  reason.
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
  a reveal's version plays no flip for it, and the GM draws no scene for a
  player's pick that resolved between two of its polls. With Realtime on,
  neither happens. The `turned` mark is the way to fix the second
  ([overhaul.md](overhaul.md), `world/10`).
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
| — | The overhaul, `world/0`–`world/10` | done on `overhaul`; live through `world/3` |

## History

- [history/status-to-world-9.md](history/status-to-world-9.md): this file as
  it stood before phase 10. The milestones in detail, the Durable Object era
  and the move to Vercel + Supabase, the feel passes, the atelier.
- [overhaul.md](overhaul.md): the overhaul's analysis, plan and log, phase by
  phase.
- [DEPLOY.md](DEPLOY.md): hosting, secrets, migrations, and the local
  rehearsal.
