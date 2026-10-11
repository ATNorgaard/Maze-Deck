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
| O1 | **Players see the scene text when the GM shares it** — a *Show the table* control per scene, and a campaign setting to make it automatic. It travels as a GM-only `share` op writing a `scene` column on the room row, never through `GameState`. *Delivered in `world/8`. The column is added by `server/migrations/2026-10-09-maze_sessions_scene.sql`, run by hand on the live project on 2026-10-09 ([DEPLOY.md](DEPLOY.md#migrations)). A table without it refuses sharing with that reason, and everything else plays as before.* *Superseded by S14 (2026-10-11): the phone no longer shows scenes, so the board no longer offers to share them. The `share` op, the `scene` column and the transport's `share` stay, unused.* |
| O2 | **One additive engine change: a `cue` on `GameEvent`** (`jam`, `reshuffle`, `found`, `through`…) so the stage plays what happened instead of inferring it from counts. Every existing rules test stays as it is. *Delivered in `world/5` as `jam`, `reshuffle`, `found`, `through` and `lost`, set only on the line that marks the moment. Phase 8 added one more mark of the same kind: `turned` on a pick's line, naming the slot and the card, so a phone that polled either side of a reveal still knows a card turned (`world/8`).* |
| O3 | **The roll stays a centred, blocking dialog** (feel/3b) and is restaged at the scale of the moment. |
| O4 | **A WebGL2 canvas replaces the SMIL grounds as the default ambient layer**, with quality tiers and the still picture as the fallback. No dependency. |
| O5 | **`packages/art`** holds the generators, shared by the atelier and the table, aliased to source. `packages/ui` and the design-sync stay out of it. |
| O6 | **Sound stays off by default, and the threshold asks once.** *Delivered in `world/9`: a card at the threshold's foot, the first time on a device; either answer is kept. The one switch covers the voices and each setting's bed.* *Since S15, each device also has two levels to turn down: the bed (Ambience) and the voices (Effects).* |
| O7 | **The new board is built beside the old**, behind a toggle, and the old one is retired at the end. *Retired in `world/10` (W1).* |
| O8 | **No rules change comes with the overhaul.** Whether a failed check should cost something stays a separate decision ([reference/balance.md](reference/balance.md)). |

## Decided while building the overhaul

Taken during phases 1–10 and recorded in [overhaul.md](overhaul.md)'s log;
gathered here in phase 10. W2 and W3 are the shapes the plan named but left
to the build.

| # | Decision |
|---|---|
| W1 | **One board.** `TableScreen` is the GM's board. The old board (`SessionScreen`, its `CheckPanel` and its CSS) is gone, and with it the per-device board choice: a stored `mazedeck.board` is ignored (`world/10`). |
| W2 | **`packages/art`, as built:** seeded randomness (FNV-1a seeds, mulberry32 streams, one salt per purpose so streams never reshuffle each other), each setting's vocabulary, the styles, and the scene generator (`SceneArt`). It is pure: React only for the SVG it returns, and the palette read off the page's CSS. The table draws the vista, the route's landmarks and the storyboard from it at runtime; the atelier draws on its benches with the same code; `scripts/bake-art.cjs` bakes the card backs and their depth layers from it. *Since the settings were built (S1–S15 below), the table no longer draws with the scene generator: its backs, vista, route, storyboard and world are the approved designs in `packages/art/src/paint`, and `bake-art.cjs` is retired. The generator stays for the atelier and the print deck.* |
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

## The art

Taken 2026-10-10 from [art-jobs.md](art-jobs.md), which has the reasoning,
the references read, and the jobs.

| # | Decision |
|---|---|
| AJ1 | **The house style is the pixel diorama:** each setting a small stage drawn from its own ramps, dithered light, lit edges and sprites, generated in `packages/art` (`pixel.ts`). The engraving style stays the route for the print deck. |
| AJ2 | **Sky high, table low.** A daylight setting keeps its daylight above the horizon, in the vista's sky and on its back, and falls to under the luminance budget (0.023 behind the faintest text) where the board puts words. |
| AJ3 | **Generated and seeded**, as W2; no image assets from elsewhere, and none from image models. |
| AJ4 | **The card families' colours are reserved:** a setting lights itself with its own family, and any other family's hue stays under about 5% of a picture. *Amended 2026-10-11: a setting may name one other family as its weather (`Biome.weather`), up to 15% of a picture: the deep forest's night sky and the Drowned Coast's storm sea, both the Wanderer's blue.* |
| AJ5 | **The backs keep still; the world moves.** Backs move only in depth, on tilt. *Amended by S5: a back tilts as a whole card; it has no depth layers.* |
| AJ6 | **The vista takes the pixel style too**, setting by setting, each measured on a phone before it ships. |
| AJ7 | **Every setting has an inside and an outside** (2026-10-11), chosen when a crossing is set up: each side its own vista and world (and, if the author keeps both, its own back). The frozen pass's peaks and ice cave were the first pair. Every art job designs both sides before building. **Except the dungeon and the tower, which stay inside only** (2026-10-11). |
| AJ8 | **Eight more settings** (2026-10-11), each its own setting, not a journey: the King's Road and the Mire (outside), the Underdark (inside), and the High Road, the Drowned Coast, the Barrow Moor, the Ember Hold and the Sunken Jungle (both sides). See [new-settings.md](new-settings.md). Each goes through design approval, then its words, palette, dark and sound, then a build. |

## The settings, built

Taken 2026-10-11 while building the approved designs, on the author's word
("Implement!"); [settings-build.md](settings-build.md) has the reasoning and
the log, phase by phase (`set/0`–`set/5`). The author can overturn any.

| # | Decision |
|---|---|
| S1 | **The deck shows the back of the side being played.** |
| S2 | **A crossing's default side is the outside** where a setting has one; the campaign remembers the last choice per setting. |
| S3 | **The designs live in `packages/art/src/paint`**: the painter (`px.js`) and one module per setting. The review page builds from them. |
| S4 | **Each setting's designs load only when it is played**: one chunk per setting, in the page and in the world's worker. |
| S5 | **Backs are baked PNGs** (`scripts/bake-backs.mjs`), one per side, and tilt as a whole card. |
| S6 | **The vista is the design, drawn live on a canvas** at 12 frames a second while on screen, each design pixel a whole number of device pixels, still under reduced motion or a still world. The route's landmarks and the storyboard's scenes are stills of it. A worker draws every frame (S12). |
| S7 | **The world is the design, drawn in a Web Worker; the GPU adds the mood.** The design works out its picture about 12 times a second, as approved; the GPU lays the mood over it at the design's size, in dithered fifths per design pixel, and scales it to the screen. *(Planned as a GPU resolve of the painter; revised because some designs shift rows of the finished picture, which only the CPU can reproduce, and a frame costs under 2 ms once only lit pixels are redrawn.)* |
| S8 | **The world's *Off* is the side's baked still frame**, which also shows while the world loads, and is the page behind every other screen. |
| S9 | **The world keeps the luminance budget behind the words itself.** The screen names its regions of words with their budgets (the ones `check-art.cjs` reads); behind them a design pixel brighter than the budget steps towards the dark in fifths until it is under, and the budget relaxes over 40 CSS pixels outside them, so it reads as a shadow, not a box. |
| S10 | **The still frame is veiled in 88% of the setting's ink** wherever it shows: a still cannot know where the words are, and at 88% even its brightest pixel stays within the 0.023 budget. *Off* is a dim ghost of the place. |
| S11 | **A setting names its own light** (`Biome.light`: gold, teal or blue, AJ4), and `biomes.test.ts` holds every setting to the same shape. |
| S12 | **Each narration line draws its card its own way** (2026-10-11, the author's word): the approved composition with a salt on every random number the design draws (its stones, scatter, stars, particles, whatever it places at random) and, for half a card's lines, mirrored, so the light falls from the other side. Seeded by the entry, so a line always comes with the same picture; the vista, the route's landmarks and the storyboard all show it. With no line (the vista at rest, the backs, the world) the design is as approved, to the byte. Every picture is now built when its card turns, so the vista is drawn in a worker. |
| S13 | **The world's light stays as the designs draw it** (2026-10-11, the author's word). It does not lean towards the part of the table in play, nor widen with ground gained, as the old world's pool did: either would brighten the picture behind the words, and the approved designs light themselves. The world moves with the crossing through the mood only (S7). |
| S14 | **A player's phone is a controller** (2026-10-11, the author's word: "the DM will be hosting and showing his screen, so the mobile user will only really need his phone when he need to choose an ability and card in the river"). It shows one thing at a time, the player's own: waiting (whose turn it is, and *You're next* the turn before theirs), the six actions on their turn, their roll (or the die to throw), their decision, the river to commit to a path, and a line each for being found and the end. The vista, the scene, the route, the threat, the party and the log are on the GM's screen, not the phone's. Behind it, the side's still frame, veiled; no animated world, for the battery. Sound, haptics and leaving are in a menu. A phone's sound stays off unless its owner turns it on. |
| S15 | **The sound has two levels per device** (2026-10-11): *Ambience* (the setting's bed) and *Effects* (the cards, the dice and the table's moments), each 0 to 100%, remembered on the device, beside the switch in the GM's drawer and the phone's menu. A slider's position is squared into gain, so its middle sounds like the middle. |

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
