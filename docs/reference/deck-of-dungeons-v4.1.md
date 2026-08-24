# Deck of Dungeons V4.1 — what's in the file at the repo root

`Deck-of-Dungeons_PRINT-COLOR_1.0.pdf` (20MB, 3 pages, built in Canva, titled
"Deck of Dungeons V4.1"). It carries the line *"Tales From the Stinky Dragon is
a D&D Actual-Play Podcast"* — so this appears to be **a separate, pre-existing
product**, not an export of this repo's design system. `print/MazeDeck_PRINT_v3.pdf`
is the one this repo generates (15 pages, printed from Chrome via `PrintSheet`).

Recorded here because it is a **fourth rules source** and the closest ancestor of
Maze Deck. Only the structural facts are noted — the card text is not
transcribed. See §2 of [BUILD-PLAN.md](../BUILD-PLAN.md) for the other three.

## Composition — 23 cards, 5 types

| Type | Copies |
|---|---|
| Clear Path | 5 |
| Obstacle | 5 |
| Wanderer | 5 |
| Item | 5 |
| Monster | 3 |

**No Dead End. No Trap.** Both are Maze Deck inventions, and both are the
categories the three rulebooks argue about most.

## Actions — six, one per ability score

One action for each of STR, DEX, **CON**, INT, WIS, CHA. Maze Deck has five and
benches CON — `packages/ui/src/types.ts` says of it: *"Carried for the sheet.
Nothing in the maze checks it."* That is a deliberate cut from this ancestor,
not an oversight.

Only STR's name survives unchanged into Maze Deck (`Forge a Path`). The CHA
action here grants another player advantage on their next check or save —
mechanically unrelated to Maze Deck's `Boost Morale`.

## Extraction caveat

Text was recovered from partial `ToUnicode` cmaps across 12 subset fonts; the
prose came out roughly half-garbled and only the numbers and headings above are
quoted with confidence. There is no PDF renderer on this machine
(`pdftoppm` is absent), so the pages could not be read visually. **Open the PDF
by hand before relying on any of this.**
