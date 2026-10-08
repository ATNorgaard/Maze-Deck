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

   Most of it is read off the difference. What the difference cannot
   say — a jam, a reshuffle, the party found — is read off the cues on
   the new log lines (DECISIONS O2).

   Pure. Nothing here knows about time or the DOM.
   ============================================================ */

import type { CardCategory, Cue, GameView, ViewSlot } from '@maze-deck/rules';
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
  /**
   * Too many blockers at once: every card in the river is swept to the
   * discard together. `faces` is what each showed — null for a card the
   * table never saw, which goes as a back.
   */
  | { kind: 'jam'; slots: number[]; faces: (CardCategory | null)[] }
  /** A card from outside the deck put onto the discard: the jam's Monster. */
  | { kind: 'feed'; category: CardCategory }
  /** The deck ran dry and the discard is gathered back into it. */
  | { kind: 'reshuffle'; count: number }
  /** Empty slots are dealt into from the deck. */
  | { kind: 'deal'; slots: number[] }
  /** Strikes reached the limit: the dark closes in before the fight. */
  | { kind: 'found' }
  /**
   * The turn passed. `to` is the seat now acting; `round` is set when
   * the pass wrapped the table and a new round began.
   */
  | { kind: 'turn'; from: string | null; to: string | null; round?: number }
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

/** The cues on the lines that are new in `next`. */
function cuesBetween(prev: GameView, next: GameView): Set<Cue> {
  const seen = prev.log.reduce((m, e) => Math.max(m, e.n), 0);
  const out = new Set<Cue>();
  for (const e of next.log) if (e.n > seen && e.cue) out.add(e.cue);
  return out;
}

/** Cards a pending decision holds off the table. They came off the deck. */
function held(v: GameView): number {
  const c = v.pending?.kind === 'choice' ? v.pending.choice : null;
  return c && (c.kind === 'scout-top' || c.kind === 'swap-river') ? c.cards.length : 0;
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

  /* A jam and a reshuffle both move cards into and out of the discard
     within one action. While either is in play, each card is counted
     onto the discard as it lands, rather than the pile jumping to its
     final count with the first. */
  const cues = cuesBetween(prev, next);
  const jam = cues.has('jam');
  const reshuffle = cues.has('reshuffle');
  const counting = jam || reshuffle;

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
        Wanderer moving on, an Obstacle cleared. The slot empties as the
        card leaves — the river shows its dashed outline, "a path is
        gone" — and the deal beat fills it. Masking the slot instead
        left a dark hole in the river for the length of whatever played
        in between, which read as the board blinking.

        Not every card that stops being face up has left. Careful
        Consideration turns two over, discards one and turns the other
        back down. The discard grew by exactly the number that left, so
        anything beyond that count was turned back, and the ones that
        left are the ones matching the discard's new top.

        In a jam only the card just taken leaves on its own, and only if
        it was leaving anyway. Everything else in the river goes
        together, in the jam's own beat.

        After a reshuffle the discard's count says nothing about what
        reached it. One card gone is one card discarded; of several, the
        card just taken left and the rest are left alone, to be dealt
        over, rather than guessed at. */
  const gone: number[] = [];
  for (let i = 0; i < width; i += 1) {
    const was = slot(cur, i);
    const is = slot(next, i);
    if (!was.faceUp || was.category === null) continue;
    if (is.faceUp && is.category === was.category) continue;
    gone.push(i);
  }
  const grew = Math.max(0, next.discardCount - cur.discardCount);
  const taken = prev.phase === 'reveal' && prev.revealed?.leavesRiver ? prev.revealed.slot : null;
  let departed = gone;
  if (jam) {
    departed = gone.filter((i) => i === taken);
  } else if (reshuffle) {
    departed = gone.length === 1 ? gone : gone.filter((i) => i === taken);
  } else if (gone.length > grew) {
    const matching = gone.filter((i) => slot(cur, i).category === next.discardTop);
    const rest = gone.filter((i) => !matching.includes(i));
    departed = [...matching, ...rest].slice(0, grew);
  }
  const turnedBack = jam ? [] : gone.filter((i) => !departed.includes(i));
  for (const i of departed) {
    const was = slot(cur, i);
    if (was.category === null) continue;
    const river = cur.river.map((s, j) => (j === i ? EMPTY : s));
    // The card lands on the discard as this beat ends.
    push(
      { kind: 'depart', slot: i, category: was.category },
      {
        river,
        discardTop: counting ? was.category : next.discardTop,
        discardCount: counting ? cur.discardCount + 1 : next.discardCount,
        revealed: null,
      },
    );
  }

  /* 3. A revealed blocker that stayed — if only for as long as it takes
        the jam it caused to sweep it away. */
  const stayed = prev.revealed ? slot(next, prev.revealed.slot) : EMPTY;
  if (
    prev.phase === 'reveal' && next.phase !== 'reveal' && prev.revealed
    && getCategory(prev.revealed.category).blocker
    && (jam || (stayed.faceUp && stayed.category === prev.revealed.category))
  ) {
    push(
      { kind: 'settle', slot: prev.revealed.slot, category: prev.revealed.category },
      { revealed: null },
    );
  }

  /* 4. The discard grew without a card crossing the river. What a jam
        adds is the jam's, below. */
  if (!jam && next.discardCount > cur.discardCount && next.discardTop) {
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

  /* 6. The discard gathered back into the deck. It plays before the deal
        that needed it, and the deck shows what it held before that deal.
        Around a jam it can fall either side of the sweep. If the discard
        still holds anything at the end, it came before: nothing reaches
        the discard after the jam's own deal. */
  const gather = (dealing: number) => push(
    { kind: 'reshuffle', count: cur.discardCount },
    { discardCount: 0, discardTop: null, deckCount: next.deckCount + dealing },
  );
  const gatherFirst = reshuffle && jam && next.discardCount > 0;
  if (gatherFirst) gather(next.river.filter((s) => s.filled).length);

  /* 7. The jam: the river swept at once, then the Monster its noise
        brings in, put on the discard from outside the deck. */
  if (jam) {
    const swept: number[] = [];
    for (let i = 0; i < width; i += 1) if (slot(cur, i).filled) swept.push(i);
    const faces = swept.map((i) => (slot(cur, i).faceUp ? slot(cur, i).category : null));
    const shown = faces.filter((f): f is CardCategory => f !== null);
    push(
      { kind: 'jam', slots: swept, faces },
      {
        river: cur.river.map(() => EMPTY),
        discardCount: cur.discardCount + swept.length,
        discardTop: shown[shown.length - 1] ?? cur.discardTop,
      },
    );
    push(
      { kind: 'feed', category: 'monster' },
      { discardCount: cur.discardCount + 1, discardTop: 'monster' },
    );
  }

  /* 8. Slots that filled from the deck, changed hands face down, or
        were turned back down.

        A face-down card replaced by another face-down card is invisible
        in the view — the redaction is doing its job — but the deck
        count still shrank by one per card dealt. If more left the deck
        than the slots above account for, and EVERY remaining face-down
        slot would be needed to explain it (a sweep), those are dealt
        too. Anything short of that is ambiguous (It's Elementary swaps
        one of three) and is left alone rather than guessed at.

        Two things explain cards leaving the deck without a slot: a
        decision now holding them off the table (a scout drew three),
        and a reshuffle, after which the deck count says nothing about
        the river at all. */
  const dealt: number[] = [];
  for (let i = 0; i < width; i += 1) {
    const was = slot(cur, i);
    const is = slot(next, i);
    if (!is.filled) continue;
    if (departed.includes(i) || turnedBack.includes(i) || !was.filled) dealt.push(i);
  }
  const drawn = Math.max(0, held(next) - held(prev));
  const unexplained = (cur.deckCount - next.deckCount) - dealt.length - drawn;
  if (unexplained > 0 && !reshuffle) {
    const hidden: number[] = [];
    for (let i = 0; i < width; i += 1) {
      const is = slot(next, i);
      if (is.filled && !is.faceUp && !dealt.includes(i)) hidden.push(i);
    }
    if (hidden.length > 0 && unexplained >= hidden.length) dealt.push(...hidden);
  }
  dealt.sort((a, b) => a - b);
  if (reshuffle && !gatherFirst) gather(dealt.length);
  if (dealt.length) {
    const river = cur.river.map((s, i) => (dealt.includes(i) ? slot(next, i) : s));
    push({ kind: 'deal', slots: dealt }, { river, deckCount: next.deckCount });
  }

  /* 9. Found: the dark closes in before the fight is handed over. */
  if (cues.has('found')) push({ kind: 'found' }, { phase: 'encounter', pending: null });

  /* 10. The turn passing, then everything else. The final step always
         presents `next` itself, so nothing can be left behind. */
  const from = seatAt(cur);
  const to = seatAt(next);
  if (from !== to || cur.round !== next.round) {
    push(
      next.round > cur.round ? { kind: 'turn', from, to, round: next.round } : { kind: 'turn', from, to },
      next,
    );
  } else {
    push({ kind: 'sync' }, next);
  }

  return steps;
}
