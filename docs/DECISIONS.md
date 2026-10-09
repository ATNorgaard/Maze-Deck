# Maze Deck — settled decisions

Outcome of the design interview, 2026-08-24. Rules live in
[reference/canonical-rules.md](reference/canonical-rules.md); this file is the
product and engineering record. **Read both before writing code.**

Decisions marked *(delegated)* were the author's call to make and were handed to
me; they are as binding as the rest, but they are the ones to revisit first if
something feels wrong in play.

## Product

| # | Decision |
|---|---|
| P1 | A **companion app for a live D&D session**, replacing dungeon mapping with a card-driven travel subsystem. Not a standalone game. |
| P2 | **The app is the deck.** There is no physical deck; the app shuffles at run start and owns all randomness. |
| P3 | **The GM runs the session.** Players join on their own phone or desktop and act on their own turn. The GM can act on behalf of any player who has no device. |
| P4 | **Campaign → Run.** A campaign owns the roster, the Maze DC and the scenario tables. A run is one crossing. Campaigns outlive runs; this is the unit players return to. |
| P5 | **No accounts.** An anonymous `playerId` in the browser owns a player's characters; a transfer code moves them to a new device. Join a session with a code and a name. |

## Rules

| # | Decision |
|---|---|
| R1 | **Canonical deck: 23 cards, 5 categories** *(delegated)*. Dead End and Trap stay defined in code as `expansion: true`, excluded from the canonical deck, art intact and ready to re-enable. |
| R2 | **Six actions, one per ability score** *(delegated)*. The five existing Maze Deck names survive; CON's is **Steel Yourself**. Every effect string is rewritten to the canonical mechanic. |
| R3 | **`MAZE_DC` 13 → 15** *(delegated)*. |
| R4 | **The river persists** across turns and refills after each pick *(delegated)* — the CON action is meaningless otherwise, and Obstacles could never reach three. |
| R5 | **Monster encounters hand off to the table** *(delegated)*. At two strikes the app pauses, the GM runs combat, then reports the result: a win removes a Monster card from the deck and resets initiative; a loss leaves ending the run to the GM. The app never models combat. |
| R6 | **Obstacle resolution: the scenario table entry suggests an ability score and DC, the GM may override before the roll** *(delegated)*. |
| R7 | **Initiative is rolled once at run start**, then fixed, and re-rolled when an encounter fires. |
| R8 | **The GM chooses per run whether the app rolls the d20 or players roll their own dice**; either way the GM confirms success or failure before it lands. |

## Architecture

| # | Decision |
|---|---|
| A1 | **`packages/rules`** — pure TypeScript, seeded RNG, no React, no DOM, no storage. The engine is the product; everything else is a view of it. |
| A2 | **Server-authoritative hidden state** *(delegated)*. Players receive a redacted river; the GM sees identities. Redaction happens before the wire, never in the client — a client-side secret is readable from the network tab. |
| A3 | **Transport-agnostic session interface**, run first through an in-process adapter. A fully playable single-screen GM build exists before any networking is written. |
| A4 | ~~**Cloudflare Workers + Durable Objects** for the live session *(delegated)* — one object per session is the authoritative game, WebSocket fan-out, no database. **Cloudflare Pages** for the app.~~ **Superseded 2026-09-21 by A4b.** |
| A4b | **Vercel + Supabase** for the live session — one Vercel deployment serves the app *and* the authority (`api/session/*`); one Postgres row per join code is the authoritative game, with `version` as a compare-and-swap token in place of the Durable Object's single thread; Supabase Realtime carries a version number and nothing else, so each client fetches its own redaction. Rooms now survive a deploy. See [DEPLOY.md](DEPLOY.md). |
| A5 | **Scenario tables are a first-class feature** *(delegated)*. Picking a card auto-draws a prompt for the GM. Ships with one original default table set; per-campaign editing. Biome-specific sets are later content. |
| A6 | **One repo** *(delegated)*: everything moves into `C:\Coding\Maze-Deck`. The hand-written `.design-sync/` config is irreplaceable and currently unversioned. Verify the design-sync build still runs after the move. |
| A7 | **Never reuse the source's names, effect wording, or art.** No mark of the originating product appears anywhere in the app. |
| A8 | **A biome is a campaign dial and pure presentation.** `RunConfig.biome` is a string the engine never reads; it rides the wire so every device reskins alike. The library exposes a `skin` (copy + back motif) and leaves colour to CSS; the app owns the biomes as content — copy, palette, motif and a full scenario set per setting. Card eyebrows keep the canonical name so the log and the rules stay legible. The printed deck is not reskinned. |

## The overhaul

Taken 2026-10-07, every one as recommended in
[overhaul.md](overhaul.md), which has the reasoning (its D1–D8).

| # | Decision |
|---|---|
| O1 | **Players see the scene text when the GM shares it** — a *Show the table* control per scene, and a campaign setting to make it automatic. It travels as a GM-only `share` op writing a `scene` column on the room row, never through `GameState`. *Delivered in `world/8`. The column is added by `server/migrations/2026-10-09-maze_sessions_scene.sql`, run by hand on the live project on 2026-10-09 ([DEPLOY.md](DEPLOY.md#migrations)). A table without it refuses sharing with that reason, and everything else plays as before.* |
| O2 | **One additive engine change: a `cue` on `GameEvent`** (`jam`, `reshuffle`, `found`, `through`…) so the stage plays what happened instead of inferring it from counts. Every existing rules test stays as it is. *Delivered in `world/5` as `jam`, `reshuffle`, `found`, `through` and `lost`, set only on the line that marks the moment. Phase 8 added one more mark of the same kind: `turned` on a pick's line, naming the slot and the card, so a phone that polled either side of a reveal still knows a card turned (`world/8`).* |
| O3 | **The roll stays a centred, blocking dialog** (feel/3b) and is restaged at the scale of the moment. |
| O4 | **A WebGL2 canvas replaces the SMIL grounds as the default ambient layer**, with quality tiers and the still picture as the fallback. No dependency. |
| O5 | **`packages/art`** holds the generators, shared by the atelier and the table, aliased to source. `packages/ui` and the design-sync stay out of it. |
| O6 | **Sound stays off by default, and the threshold asks once.** *Delivered in `world/9`: a card at the threshold's foot, the first time on a device; either answer is kept. The one switch covers the voices and each setting's bed.* |
| O7 | **The new board is built beside the old**, behind a toggle, and the old one is retired at the end. *Retired in `world/10` (W1).* |
| O8 | **No rules change comes with the overhaul.** Whether a failed check should cost something stays a separate decision ([reference/balance.md](reference/balance.md)). |

## Decided while building the overhaul

Taken during phases 1–10 and recorded in [overhaul.md](overhaul.md)'s log;
gathered here in phase 10. W2 and W3 are the shapes the plan named but left
to the build.

| # | Decision |
|---|---|
| W1 | **One board.** `TableScreen` is the GM's board. The old board (`SessionScreen`, its `CheckPanel` and its CSS) is gone, and with it the per-device board choice: a stored `mazedeck.board` is ignored (`world/10`). |
| W2 | **`packages/art`, as built:** seeded randomness (FNV-1a seeds, mulberry32 streams, one salt per purpose so streams never reshuffle each other), each setting's vocabulary, the styles, and the scene generator (`SceneArt`). It is pure: React only for the SVG it returns, and the palette read off the page's CSS. The table draws the vista, the route's landmarks and the storyboard from it at runtime; the atelier draws on its benches with the same code; `scripts/bake-art.cjs` bakes the card backs and their depth layers from it. |
| W3 | **The room's `scene` column, as built:** `jsonb`, nullable, at most 2 KB by constraint, holding `{key, category, entryId, text}`. Only the GM-only `share` op writes it, and only a scene whose key names a pick in the run's public log and the card that pick turned (W4), with 1–600 characters of text. A repeat writes nothing, `null` takes it down, and a new crossing clears it. It travels beside the view, never inside it. The authority checks for the column, so code can ship before the migration (`world/8`). |
| W4 | **A second additive mark on the log: `turned`** on a pick's line, naming the slot and the card, and since 2026-10-09 who took the path, the round and the progress before it. It is public, because the card is face up for everyone. Any client can tell a card turned without catching the reveal phase, the authority can check a shown scene against its card (`world/8`), and the GM's chronicle draws its scenes from it, with who and when as they were, however late the GM's device catches up. |
| W5 | **Schema changes are dated SQL files in `server/migrations/`**, run by hand, and only with the author's go-ahead: the Supabase project is shared with other apps. Each is additive, the code feature-detects it, and [DEPLOY.md](DEPLOY.md#migrations) records when each ran. |
| W6 | **A hosted game is rehearsed without the hosted half.** `scripts/local-session.mjs` runs the real authority against an in-memory table; nothing touches the live database to be tested (`world/8`). |
| W7 | **A phone's throw is ceremony.** Its number never leaves the phone; the GM types in the roll the room acts on. A phone never shows a verdict, which is the GM's to give (`world/8`). |
| W8 | **One mood, many layers.** The world layer, the setting's bed and the phone's haptics all follow one mood, taken from the presented view, so they never disagree. The world has tiers (high, low, still; *Off* is the old animated ground). *Auto* starts low on a coarse pointer or a machine with few cores, and steps down if frames run long (`world/3`, `world/8`, `world/9`). |
| W9 | **Haptics are on by default** where the device has them, with a toggle each device remembers. Sound stays off by default (O6) (`world/8`). |

Still open from the build: **D9**, a size step between `sm` and `md` for
laptops with about 657px of viewport. It is a change to `packages/ui` and its
design-sync, so it is the author's call
([overhaul.md](overhaul.md#d9--for-the-author)).

## Build order

Sliced so every milestone ends with something that runs, because sessions will
be cut by usage limits mid-build.

| | Milestone | Verified by |
|---|---|---|
| **M0** | Move into the git repo, first commit, `README.md`, `docs/STATUS.md` | `packages/ui` still builds; design-sync still runs |
| **M1** | Engine: canonical rules, seeded, plus the 23-card composition through `types.ts` and the count tokens | `npm test` — no browser needed, so it is the cheapest milestone to verify |
| **M2** | Single-screen GM app: a full run playable solo, local storage, campaign and roster | Playing a run end to end |
| **M3** | Scenario tables: default set, per-campaign editor, auto-draw on pick | A GM runs a crossing without improvising cold |
| **M4** | Multiplayer: Durable Object session, join codes, redacted player view, GM proxy control | Two devices, one run |
| **M5** | Deck and print regeneration: `Steel Yourself` glyph and ability card, 23-card print sheet | Re-print and design-sync |

**M1 first and alone.** It is verifiable by `npm test` with no browser, no
screenshots and no round-trips, which makes it by far the most progress per
token — and everything downstream is a view of it.

## Session discipline

Sessions get cut. Every one of them ends with:

1. A commit. **Never leave the tree non-building**, even if that means stopping early.
2. `docs/STATUS.md` rewritten to name the single next action, so a cold agent with no memory of this conversation can resume.

## Open — deliberately deferred

Not forgotten, just not now: re-enabling Dead End and Trap as an expansion;
the `+1d4` ally boon from the source's GM guidance; spectator links; and
anything resembling a persistent account. (Biome-specific scenario tables
shipped with the biomes themselves — see A8.)
