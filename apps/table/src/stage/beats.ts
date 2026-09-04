/* ============================================================
   Beats.

   The server sends whole views, and one action can move five things
   at once: the picked card leaves, the discard grows, a pip fills, the
   slot refills, the turn passes. Rendered in one frame that is a
   teleport. Played one after another it is a scene.

   `plan(prev, next)` turns the difference between two consecutive
   views into an ordered list of steps. Each step is a beat and the
   view to present once it has played, so the board always renders a
   coherent state — never a half-applied one — and the last step's view
   is exactly `next`.

   Pure. Nothing here knows about time or the DOM.
   ============================================================ */

import type { CardCategory, GameView, ViewSlot } from '@maze-deck/rules';
import { getCategory } from '@maze-deck/ui';

export type Beat =
  /** A river card is turned face up where it lies. */
  | { kind: 'reveal'; slot: number; category: CardCategory }
  /** A face-up card leaves the river for the discard. */
  | { kind: 'depart'; slot: number; category: CardCategory }
  /** A blocker was revealed and is staying put. */
  | { kind: 'settle'; slot: number; category: CardCategory }
  /** Cards reached the discard without crossing the river (a forge, a sweep). */
  | { kind: 'discard'; category: CardCategory; count: number }
  /** The escape track gained a pip. */
  | { kind: 'progress'; value: number }
  /** The threat track gained a pip. */
  | { kind: 'strike'; value: number }
  /** Empty slots are dealt into from the deck. */
  | { kind: 'deal'; slots: number[] }
  /** The turn passed. `to` is the seat now acting. */
  | { kind: 'turn'; from: string | null; to: string | null }
  /** Everything else, applied silently. Always the last step. */
  | { kind: 'sync' };

export interface Step {
  beat: Beat;
  /** What the board presents once this beat has played. */
  after: GameView;
}

const EMPTY: ViewSlot = { category: null, faceUp: false, filled: false };

function seatAt(v: GameView): string | null {
  if (v.order.length === 0) return null;
  return v.order[v.turn % v.order.length] ?? null;
}

export function plan(prev: GameView, next: GameView): Step[] {
  const steps: Step[] = [];
  let cur: GameView = prev;
  const push = (beat: Beat, patch: Partial<GameView>) => {
    cur = { ...cur, ...patch };
    steps.push({ beat, after: cur });
  };

  const width = Math.max(prev.river.length, next.river.length);
  const slot = (v: GameView, i: number): ViewSlot => v.river[i] ?? EMPTY;

  /* 1. A card turned over where it lies. */
  const revealedNow = next.phase === 'reveal' && next.revealed
    && (prev.phase !== 'reveal' || prev.revealed?.slot !== next.revealed.slot);
  if (revealedNow && next.revealed) {
    const river = cur.river.map((s, i) => (i === next.revealed?.slot ? slot(next, i) : s));
    push(
      { kind: 'reveal', slot: next.revealed.slot, category: next.revealed.category },
      { river, revealed: next.revealed, phase: 'reveal' },
    );
  }

  /* 2. Face-up cards that left the river: the reveal resolving, a
        Wanderer moving on, an Obstacle cleared. The slot is left as it
        was — the deal beat replaces it — unless nothing is coming, in
        which case it empties here.

        Not every card that stops being face up has left. Careful
        Consideration turns two over, discards one and turns the other
        back down. The discard grew by exactly the number that left, so
        anything beyond that count was turned back, and the ones that
        left are the ones matching the discard's new top. */
  const gone: number[] = [];
  for (let i = 0; i < width; i += 1) {
    const was = slot(cur, i);
    const is = slot(next, i);
    if (!was.faceUp || was.category === null) continue;
    if (is.faceUp && is.category === was.category) continue;
    gone.push(i);
  }
  const grew = Math.max(0, next.discardCount - cur.discardCount);
  let departed = gone;
  if (gone.length > grew) {
    const matching = gone.filter((i) => slot(cur, i).category === next.discardTop);
    const rest = gone.filter((i) => !matching.includes(i));
    departed = [...matching, ...rest].slice(0, grew);
  }
  const turnedBack = gone.filter((i) => !departed.includes(i));
  for (const i of departed) {
    const was = slot(cur, i);
    const is = slot(next, i);
    if (was.category === null) continue;
    const stillThere = is.filled;
    const river = cur.river.map((s, j) => (j === i && !stillThere ? EMPTY : s));
    // The card lands on the discard as this beat ends.
    push(
      { kind: 'depart', slot: i, category: was.category },
      {
        river,
        discardTop: next.discardTop,
        discardCount: next.discardCount,
        revealed: null,
      },
    );
  }

  /* 3. A revealed blocker that stayed. */
  if (
    prev.phase === 'reveal' && next.phase !== 'reveal' && prev.revealed
    && slot(next, prev.revealed.slot).faceUp
    && slot(next, prev.revealed.slot).category === prev.revealed.category
    && getCategory(prev.revealed.category).blocker
  ) {
    push(
      { kind: 'settle', slot: prev.revealed.slot, category: prev.revealed.category },
      { revealed: null },
    );
  }

  /* 4. The discard grew without a card crossing the river. */
  if (next.discardCount > cur.discardCount && next.discardTop) {
    push(
      { kind: 'discard', category: next.discardTop, count: next.discardCount - cur.discardCount },
      { discardTop: next.discardTop, discardCount: next.discardCount },
    );
  }

  /* 5. The tracks. Only gains are beats; a reset (an encounter won)
        applies silently at the end. */
  if (next.progress > cur.progress) {
    push({ kind: 'progress', value: next.progress }, { progress: next.progress });
  }
  if (next.strikes > cur.strikes) {
    push({ kind: 'strike', value: next.strikes }, { strikes: next.strikes });
  }

  /* 6. Slots that filled from the deck, changed hands face down, or
        were turned back down.

        A face-down card replaced by another face-down card is invisible
        in the view — the redaction is doing its job — but the deck
        count still shrank by one per card dealt. If more left the deck
        than the slots above account for, and EVERY remaining face-down
        slot would be needed to explain it (a sweep), those are dealt
        too. Anything short of that is ambiguous (It's Elementary swaps
        one of three) and is left alone rather than guessed at. */
  const dealt: number[] = [];
  for (let i = 0; i < width; i += 1) {
    const was = slot(cur, i);
    const is = slot(next, i);
    if (!is.filled) continue;
    if (departed.includes(i) || turnedBack.includes(i) || !was.filled) dealt.push(i);
  }
  const unexplained = (cur.deckCount - next.deckCount) - dealt.length;
  if (unexplained > 0) {
    const hidden: number[] = [];
    for (let i = 0; i < width; i += 1) {
      const is = slot(next, i);
      if (is.filled && !is.faceUp && !dealt.includes(i)) hidden.push(i);
    }
    if (hidden.length > 0 && unexplained >= hidden.length) dealt.push(...hidden);
  }
  dealt.sort((a, b) => a - b);
  if (dealt.length) {
    const river = cur.river.map((s, i) => (dealt.includes(i) ? slot(next, i) : s));
    push({ kind: 'deal', slots: dealt }, { river, deckCount: next.deckCount });
  }

  /* 7. The turn passing, then everything else. The final step always
        presents `next` itself, so nothing can be left behind. */
  const from = seatAt(cur);
  const to = seatAt(next);
  if (from !== to || cur.round !== next.round) {
    push({ kind: 'turn', from, to }, next);
  } else {
    push({ kind: 'sync' }, next);
  }

  return steps;
}
