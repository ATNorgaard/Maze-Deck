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
| A4 | **Cloudflare Workers + Durable Objects** for the live session *(delegated)* — one object per session is the authoritative game, WebSocket fan-out, no database. **Cloudflare Pages** for the app. |
| A5 | **Scenario tables are a first-class feature** *(delegated)*. Picking a card auto-draws a prompt for the GM. Ships with one original default table set; per-campaign editing. Biome-specific sets are later content. |
| A6 | **One repo** *(delegated)*: everything moves into `C:\Coding\Maze-Deck`. The hand-written `.design-sync/` config is irreplaceable and currently unversioned. Verify the design-sync build still runs after the move. |
| A7 | **Never reuse the source's names, effect wording, or art.** No mark of the originating product appears anywhere in the app. |
| A8 | **A biome is a campaign dial and pure presentation.** `RunConfig.biome` is a string the engine never reads; it rides the wire so every device reskins alike. The library exposes a `skin` (copy + back motif) and leaves colour to CSS; the app owns the biomes as content — copy, palette, motif and a full scenario set per setting. Card eyebrows keep the canonical name so the log and the rules stay legible. The printed deck is not reskinned. |

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
