# Canonical rules — as decided 2026-08-24

**Source of truth: the Deck of Dungeons rules sheet** (user decision, Round 1 Q5),
read from the rendered PDF pages — most of it is embedded as images, so plain
text extraction misses it. Restated here **in our own words**: mechanics only,
no card text, names, or art carried over. See
[deck-of-dungeons-v4.1.md](deck-of-dungeons-v4.1.md) for provenance and the IP
constraint.

This file supersedes the Danish methodology PDF and the prototype engine
wherever they disagree.

## Deck — 23 cards, 5 categories

| Category | Copies |
|---|---|
| Clear Path | 5 |
| Obstacle | 5 |
| Wanderer | 5 |
| Item | 5 |
| Monster | 3 |

**No Dead End. No Trap** — Obstacle absorbs hazards, traps, puzzles and
mysteries. Both are Maze Deck inventions and are not part of the canonical deck.

Difficulty knobs: add Clear Path cards to make a run easier, Monster cards to
make it harder.

## Turn structure

1. Order is either rolled initiative or simply around the table.
2. One turn per player per round.
3. The river holds **3 cards face down** — left, centre, right.
4. On a turn the player takes **one action**, *then* **picks one card** from the
   river. Alternatively the action may be spent attempting to resolve an
   Obstacle already sitting in the river.
5. **The picked card is never named to the players.** The GM narrates a scenario
   representing it instead. The card's mechanical consequence is still public.

## Categories

- **Clear Path** — scores the party 1 point. **5 points wins the run.**
- **Monster** — discarded on reveal; the party takes **1 strike**. At **2
  strikes** the party may face a monster encounter. Initiative resets. If the
  party wins the encounter, **one Monster card is removed from the deck**,
  thinning future danger. The run continues.
- **Obstacle** — **stays in the river** until resolved. A player may spend their
  action attempting to resolve it rather than taking a listed action. If
  **3 Obstacles fill the river**, all three are discarded and **one extra
  Monster card is added to the discard pile**.
- **Item** — the player keeps it or leaves it; either way the card is discarded.
- **Wanderer** — friend or foe is the player's read. Some **stay in the river**,
  others leave.

## Actions — six, one per ability score

Effects, restated. Names are the source's and **will not be used** — see Q2 of
Round 2 for our own naming.

| Score | Effect |
|---|---|
| STR | Put 2 extra Clear Path cards into the discard pile. |
| DEX | Draw 3 from the deck; 1 goes back on top, the other 2 shuffle back in. |
| CON | Discard the whole river and deal 3 fresh cards. |
| INT | Draw 2 from the deck; 1 replaces a river card; the rest go back on top. |
| WIS | Reveal 2 river cards; discard 1; the 2 remaining shuffle back face down. |
| CHA | Grant another player advantage on their next check or save. |

## Difficulty

**Maze DC 15** by default (not 13 — that number came from the Danish document).
Lower it for low-tier characters, raise it for high-tier.

## GM guidance in the source

- Set the scene as the party moves.
- On an ally's turn, randomly pick a player and grant **+1d4** on their next
  action; that player rolls the d4.
- For each Clear Path earned, describe the clue or progress uncovered.
- **Build random tables** per category — roughly 6 entries each, 2 for monsters
  — and narrate picks from them.
- A three-tier convention for scenario text: landmark information is free,
  hidden information costs something to learn, secret information needs a roll.
  (The source credits this to a third-party blog, so it is not theirs either.)

## Rules the source leaves open — our engine must decide

1. **Does the river persist between turns?** Not stated outright. It must:
   the CON action (dump the river, redeal) would be worthless if a fresh river
   were dealt every turn anyway, and Obstacles could never accumulate to three.
   **Reading adopted: the river persists and refills after each pick.**
2. Where a card displaced by the INT action goes (discard, or bottom of deck).
3. What DC and which ability score an Obstacle resolution attempt uses.
4. What happens if the party *loses* a monster encounter — the source only
   describes winning.
5. Whether the river refills immediately when the WIS action discards a card.

## Not canonical — inventions from the Danish document

Carried no further unless deliberately re-adopted: the d6 end-of-round action
lockout, cutting the action list to party size, Dead End, Trap, the 15-card and
28-card decks, DC 13, and treating a second monster as an instant loss.
