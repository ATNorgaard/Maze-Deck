# Maze Deck — build plan

How we get from "a design system plus a clickable prototype" to "a game you can
actually run at a table". Written 2026-08-23, after importing the Claude Design
project `Maze Deck.dc.html`.

---

## 1. What already exists

| Piece | Where | State |
|---|---|---|
| React component layer, 13 components | `packages/ui` (`@maze-deck/ui`) | **Done.** Built (`dist/`), tokenised, print-accurate, previewed |
| Design tokens + print sheet | `packages/ui/src/styles`, `design-system/` | **Done.** `--md-u` is a millimetre; card geometry is physically correct |
| Deck definition (7 categories, 28 cards, 5 abilities) | `packages/ui/src/types.ts` | **Done.** Exported as `CATEGORIES` / `ABILITIES` / `DECK_TOTAL` |
| Printed deck | `print/MazeDeck_PRINT_v3.pdf`, `Deck-of-Dungeons_PRINT-COLOR_1.0.pdf` | **Printed.** Card text is now fixed in ink |
| Original rules spec (Danish) | `docs/reference/the-river-spec.da.md` | Authoritative *intent*, but describes an older 15-card deck |
| Six-screen prototype with a working loop | `design/dc/Maze Deck.dc.html` | **Imported.** Landing → auth → character → create → join → session |
| Design-system sync pipeline | `.design-sync/`, `.ds-sync/`, `ds-bundle/` | Working. Read `.design-sync/NOTES.md` before touching it |

The Claude Design project's `_ds/maze-deck-.../` files (`_ds_bundle.css`,
`_ds_bundle.js`, `styles.css`, `_ds_manifest.json`) are generated output of
`packages/ui` — the local copies live in `ds-bundle/`. Nothing is authored
there; edit the library and re-run the sync.

What does **not** exist: an application, a rules engine, tests, a git repo.

### What the imported design actually contributes

`Maze Deck.dc.html` is not code to port — it is a **specification of the
interaction**, and a good one. Take from it:

- **The six screens and their routing** (`isLanding` / `isAuth` / `isChar` /
  `isCreate` / `isJoin` / `isSession`), including the dev jump-bar.
- **The session layout**: river centre, ActionBar above it, ScoreTracks, deck +
  discard piles, seat list, event log, GM drawer, pause/save, copy-log, outcome
  panel.
- **The two-phase turn made visible**: `phase: 'act' | 'reveal' | 'over'` with a
  phase label, a hint line, and an ActionBar that greys out when it is not your
  moment. This is the design's best idea and it must survive.
- **The pending-check card**: a roll is shown as `d20 + mod vs DC` with a
  verdict, and the GM can *flip the result before it lands* (`flipPending`)
  before `applyPending` commits it. Keep this exactly.
- **The narrative log** as first-class output — numbered, colour-coded by kind
  (`good` / `bad` / `card` / `muted` / `sys`), copyable into session notes.
- **Character/run setup**: 8 archetypes with stat mods, a +9 point budget, six
  biomes with flavour, DC and escape-target steppers, and the "strongest door"
  readout that converts a modifier into a hit probability.
- **`localStorage` persistence** under `mazedeck.run.v1`.

---

## 2. The one real problem: there are three rulebooks

The prototype's rules engine, the printed card text, and the original Danish
spec **do not agree**. This has to be settled before any engine code is written,
because everything else is downstream of it.

| Rule | Danish spec (PDF) | Printed deck / `types.ts` | Prototype (`.dc.html`) |
|---|---|---|---|
| Deck | 15 cards, 4 types | **28 cards, 7 types** (6/4/4/3/3/4/4) | 28 cards, same 7 types ✅ |
| Escape / confrontation | 5 Right Paths / 2 Monsters | 5 / 2 ✅ | 5 (configurable 3–8) / 2 ✅ |
| **Forge a Path** (STR) | Add 2 Right Paths from reserve **to the discard** — deck dilution | Same ✅ | ❌ Removes a face-up **Obstacle** from the river |
| **Scout Ahead** (DEX) | See top of deck **and** one river card, take either | Same ✅ | ❌ Just flips one face-down river card |
| **It's Elementary** (INT) | See top 3, one to bottom, two back on top in any order | Same ✅ | ❌ Only peeks at the next card |
| **Careful Consideration** (WIS) | Reveal 2 river cards | Same ✅ | Same ✅ |
| **Boost Morale** (CHA) | Remove a Dead End **permanently**, replace it | Same ✅ | ⚠️ Discards it — it comes back on reshuffle |
| Blocker reset | Three **Dead Ends** → remove them, add a Monster **from reserve into the deck** | conventions.md: "three blockers ⇒ clear all and add a Monster" | ❌ Three **Dead Ends or Obstacles** face-up → clears river, drops a Monster **into the river**, threat +1 immediately |
| Trap | DC ±1, **removed from the game** | "DC 13 ± 1 at once. Leaves the game either way." | ❌ Always DC +1, pushed to **discard** — returns on reshuffle |
| Defeated Monster | Card removed permanently (deck dilution) | — | Not modelled |
| Reserve pile (extra Paths / Monsters) | Required | — | Not modelled |
| Party smaller than 5 | Permanently cut actions to party size | `ActionBar abilities?` supports it | Not wired up |
| Initiative | Players **and the GM/maze** roll; order doubles as combat order | — | Fixed seat order |

**Why the prototype diverged, and why it matters.** Every rewritten ability is
one where the printed rule requires *a decision made after new information*:
Scout Ahead shows you two cards then asks which you take; It's Elementary shows
three then asks how to reorder them. The prototype's model — one action resolves
to one immediate effect — could not express that, so those abilities were
quietly replaced with one-shot versions, and Forge a Path was repurposed to fill
the resulting hole (nothing else could clear an Obstacle).

So this is not sloppiness in the prototype, it is a **missing concept**: the
engine needs an interactive sub-phase. That is the single most important
architectural requirement in this document (§4).

**Recommendation.**

1. **The printed deck wins.** The cards are physically printed; their text is
   the rulebook a table will read. `packages/ui/src/types.ts` already matches
   it. The Danish PDF stays as design rationale, not as the spec.
2. **Adopt the reserve and the removed-from-game pile** — the printed text needs
   both (Forge a Path draws from reserve, Trap "leaves the game").
3. **Close the Obstacle gap deliberately.** With Forge a Path restored to deck
   dilution, *no ability removes an Obstacle*, and the printed Obstacle card
   says "stays in the river until an action check resolves it". Pick one:
   (a) an Obstacle is cleared by a plain check against the Maze DC, spending the
   turn's action — the card's own text, no new ability needed *(recommended)*;
   (b) Obstacles are a GM-adjudicated freeform check;
   (c) Forge a Path keeps the prototype's meaning and the printed card is wrong.
4. **Blocker reset**: count Dead Ends *and* Obstacles (three real blockers is
   three real blockers, and the prototype is right about the feel), but follow
   the spec on the consequence — the Monster goes **into the deck**, not
   straight into the river. The prototype's version double-counts threat.
5. Ship the reconciled ruleset as `packages/rules/src/spec.ts` with a comment
   on every deviation from the printed card, and a link to this section.

Open decisions are collected in §7.

---

## 3. Architecture

```
CardGame/
  packages/ui/          @maze-deck/ui      — unchanged, do not disturb
  packages/rules/       @maze-deck/rules   — NEW. Pure TS. No React. The engine.
  apps/table/           NEW. Vite + React. The application.
  design-system/        print/proof pipeline — unchanged
  design/dc/            imported Claude Design source, reference only
  docs/                 this plan + extracted spec
```

**No workspace root.** `.design-sync/NOTES.md` documents the converter being
invoked with `--node-modules packages/ui/node_modules`; npm workspaces would
hoist that directory and break the design-system sync. Instead:

- `packages/rules` is **source-only** — its own `package.json` (vitest +
  typescript, no build), no `dist`.
- `apps/table` reaches both packages through a Vite alias plus a `tsconfig`
  path: `@maze-deck/rules` → `../../packages/rules/src/index.ts`,
  `@maze-deck/ui` → `../../packages/ui/src/index.ts` (source, so the app gets
  HMR into the component library too; the built `dist/` stays for design-sync).
- Three `npm install`s. That is the price of not breaking the sync pipeline, and
  it is worth it. Revisit workspaces only alongside a NOTES.md update.

**Layering rule:** `rules` knows nothing about React, the DOM, `localStorage`,
or `Math.random`. `ui` knows nothing about the rules. `apps/table` is the only
place they meet.

---

## 4. Engine contract

Sketch, to be firmed up in M1. The shape matters more than the names.

```ts
// packages/rules/src/index.ts
export interface RunConfig {
  seed: string;              // every run is replayable
  mazeDc: number;            // default MAZE_DC (13)
  escapeTarget: number;      // default ESCAPE_TARGET (5)
  riverWidth: number;        // default RIVER_WIDTH (3) — never varies in play
  abilities: AbilityKey[];   // cut to party size when < 5 players
  seats: Seat[];
}

export interface GameState {
  config: RunConfig;
  rng: RngState;                       // seeded, serialisable, in-state
  deck: CardCategory[];                // top of deck = end of array
  river: Slot[];                       // ALWAYS config.riverWidth long
  discard: CardCategory[];
  removed: CardCategory[];             // traps, defeated monsters — gone for good
  reserve: Partial<Record<CardCategory, number>>; // Forge a Path, blocker-reset monsters
  progress: number;
  threats: number;
  turn: number; round: number;
  phase: 'act' | 'awaiting-choice' | 'reveal' | 'over';
  pendingCheck: Check | null;          // a roll shown but not yet applied
  pendingChoice: Choice | null;        // ← the concept the prototype lacked
  locked: AbilityKey[];
  outcome: 'escape' | 'confrontation' | null;
  log: GameEvent[];
}

export type GameAction =
  | { type: 'USE_ABILITY'; ability: AbilityKey }
  | { type: 'OVERRIDE_CHECK'; success: boolean }   // GM flip, before it lands
  | { type: 'APPLY_CHECK' }
  | { type: 'RESOLVE_CHOICE'; payload: unknown }   // Scout / It's Elementary
  | { type: 'PICK_SLOT'; index: number }
  | { type: 'END_TURN' };

export function createGame(config: RunConfig): GameState;
export function apply(state: GameState, action: GameAction): {
  state: GameState;
  events: GameEvent[];
};
export function legalActions(state: GameState): GameAction[];
```

Three things this buys us that the prototype could not have:

- **`pendingChoice`** makes Scout Ahead and It's Elementary expressible as
  printed, instead of rewritten.
- **Seeded RNG in state** makes the whole run deterministic: a bug is
  reproducible from `seed` + the action list, and tests are not flaky.
- **`legalActions`** lets the UI grey things out from the engine rather than
  from ad-hoc conditions. The prototype's `barLocked` currently conflates "the
  d6 locked this action" with "it is not the act phase" — two different
  meanings, one grey.

### Invariants the tests must hold

1. `river.length === config.riverWidth`, always, in every state.
2. `deck + discard + river + removed + reserve-spent === DECK_TOTAL + issued reserve`.
3. A Trap, once resolved, never appears again.
4. `progress` only rises; `outcome` is terminal — no action changes a finished game.
5. Reshuffle preserves the delayed-reward rule: Forge a Path's new Clear Paths
   enter the **discard**, so they cannot be drawn this cycle.
6. The river refills as long as any card exists anywhere; it may never silently
   run below three (a live bug in the prototype when deck and discard are both
   empty).
7. Blocker reset fires once per triggering state and increments threat once.

---

## 5. Milestones

### M0 — Foundation (half a day)

- `git init`, first commit. **`.design-sync/` and `docs/` are currently
  unversioned and irreplaceable** — NOTES.md flags this and it is the highest
  cheap-loss risk in the repo.
- Root `README.md`: what this repo is, the three sub-projects, how to run each.
- Settle §7's open decisions.

*Done when:* the repo is under version control and a newcomer can build
`packages/ui` from the README alone.

### M1 — Rules engine (2–3 days)

- `packages/rules` with `spec.ts` (re-exporting `CATEGORIES`/`ABILITIES` from
  `@maze-deck/ui` — the composition stays defined once), `rng.ts` (seeded
  xorshift/mulberry32), `state.ts`, `apply.ts`, `events.ts`.
- All five abilities as printed, including the two that need `pendingChoice`.
- Vitest: unit tests per ability, per card category, plus property tests for the
  seven invariants over thousands of seeded random playthroughs.
- A headless `simulate(seed, policy)` harness: run 10k games, print escape rate,
  average rounds, and confrontation rate. **This is how the deck gets balanced**
  — 6 Clear Paths in 28 cards with a target of 5 is tight, and we should know
  the real numbers before printing another deck.

*Done when:* `npm test` in `packages/rules` is green, and the simulator reports
a win rate we are willing to defend.

### M2 — App shell (1–2 days)

- `apps/table`: Vite + React 18 + TS strict, aliases to both packages.
- Routing for the six screens (React Router, or a `screen` state machine — the
  prototype's flat switch is honestly adequate and cheaper).
- `MazeDeckProvider` at the root; **every** screen inside it (a component
  outside `.md-root` silently renders unstyled — see `conventions.md` §1).
- Persistence: `mazedeck.run.v2` with a migration from the prototype's `v1`
  payload, and a schema version in the blob from day one.
- Keep the dev jump-bar from the design — it is a real productivity feature.

*Done when:* all six screens render, navigation works, a reload restores state.

### M3 — The session screen (3–4 days) ← *the actual product*

Port the design's session layout against the real engine: river, ActionBar,
ScoreTracks, deck/discard piles, seat list, pending-check card with the GM flip,
event log, GM drawer, pause & save, copy log, outcome panel.

New work beyond the prototype:

- **Choice UI** for Scout Ahead (two cards, pick one) and It's Elementary (three
  cards, order them). Reuse `DeckCard`; the pick affordance already exists.
- **Obstacle clearing** per the §2.3 decision.
- Reserve and removed-from-game counters — a table needs to see deck dilution
  happening, it is the whole point of Forge a Path.
- Animation on reveal and on refill. `mdRoll` / `mdGlow` keyframes already exist
  in the design's inline style; move them into `packages/ui`.

*Done when:* a full run is playable end to end on one screen, both outcomes
reachable, and the log reads as a usable session recap.

### M4 — Setup screens (2 days)

Character (archetypes, +9 budget, the "strongest door" probability readout), run
creation (name, biome, DC, escape target, seats, deck composition bar), and the
lobby. Wire the seats from the create screen into the run — in the prototype
`extraSeats` is collected and then never reaches the game. Cut abilities to
party size here, per the spec's scaling rule.

*Done when:* a run created on screen is the run that gets played.

### M5 — Polish, a11y, parity (2 days)

- Keyboard path through a whole turn; focus management on phase change.
- `prefers-reduced-motion`.
- Colour independence: `shapeCode` corner marks already exist in `types.ts` —
  make sure they are actually rendered and legible.
- **Deck-composition parity check**: the 28-card composition is written out in
  **three** places — `packages/ui/src/types.ts` (`copies`),
  `packages/ui/src/styles/tokens.css` (`--md-count-*`, which is what ships to
  Claude Design), and `design-system/tokens.css` (`--count-*`, which drives the
  print sheet). They agree today; nothing enforces it. Add a script that fails
  the build when they diverge, and have `packages/rules` read only `types.ts`.
- CI: typecheck + test + build on push.

### M6 — Beyond one screen (only after M5)

The prototype's auth, join code and lobby are **mockups with no backend**.
Recommendation: ship v1 as GM-run on a single shared screen, guest-only, no
accounts. Then, in order: (a) read-only player view over a shared session id,
(b) private information — note that Scout Ahead and It's Elementary reveal cards
*to one player*, which the public log currently broadcasts to everyone; that is
fine on a shared screen and wrong the moment there is a second device, (c)
accounts, only if a roster that persists between sessions is genuinely wanted.

---

## 6. Prototype bugs to carry into the test suite

Found while reading `design/dc/Maze Deck.dc.html`. Each becomes a red test in M1.

1. Blocker reset adds `threats += 1` *and* leaves the Monster face-up in the
   river; taking it adds another threat — one event, two threats, instant
   confrontation.
2. Traps go to `discard`, so they return after a reshuffle despite the card
   reading "leaves the game either way".
3. If deck and discard are both empty, `afterReveal` leaves a river slot `null`
   forever and the river runs two wide.
4. `extraSeats` is never initialised in the constructor and never reaches
   `freshGame()` — seats added on the create screen are silently dropped.
5. `resetRun()` keeps the previous run config and seat list.
6. `barLocked` uses the locked-actions channel to express "wrong phase".
7. Trap DC is hardcoded `dc + 1`; the printed card says `± 1`.

---

## 7. Open decisions — needed before M1

1. **Canonical ruleset** — printed deck wins over the Danish PDF? *(recommended:
   yes; the cards are printed)*
2. **Obstacle removal** — plain Maze DC check spending the action (recommended),
   GM freeform, or keep the prototype's Forge-a-Path-clears-Obstacles?
3. **Blocker reset trigger** — three Dead Ends (spec) or three blockers of any
   kind (prototype/conventions)? *(recommended: any blocker, monster into deck)*
4. **Escape target** — fixed at 5, or GM-configurable 3–8 as the prototype
   allows? *(recommended: configurable, default 5 — it is the tuning dial)*
5. **Accounts** — is a persistent roster in scope for v1? *(recommended: no)*
6. **Second device** — is a player view a v1 goal, or v2? *(recommended: v2)*

Answers to 1–3 change engine code. Answers to 5–6 change how much of the
prototype's screen inventory we build at all.

---

## 8. Do not break

From `.design-sync/NOTES.md`, carried here so it is not lost:

- **`--md-u` is a millimetre.** Screen sizes are a consequence of the print
  spec. Need a different digital scale? Add a size step, never change the base.
- **Do not repoint `cssEntry`** at `src/styles/index.css` — the converter does
  not follow `@import`s and every design renders unstyled.
- **Do not delete `dtsPropsFor`** in `.design-sync/config.json`; `River.slots`
  and `ActionBar.abilities` do not auto-extract.
- The `.md-*` classes are internal. Layout glue uses tokens and flex/grid only.
- Fonts (Cinzel, Spectral) are fetched from Google Fonts at runtime. If that
  host is ever blocked the engraved identity is lost — vendoring is the fix.
