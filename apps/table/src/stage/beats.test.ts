/* The choreographer's diff. These protect the property that matters:
   whatever beats are played, the board ends on exactly the truth. */

import { describe, expect, it } from 'vitest';
import type { GameEvent, GameView, ViewSlot } from '@maze-deck/rules';
import { plan } from './beats';

const down = (): ViewSlot => ({ category: null, faceUp: false, filled: true });
const up = (category: ViewSlot['category']): ViewSlot => ({ category, faceUp: true, filled: true });
const empty = (): ViewSlot => ({ category: null, faceUp: false, filled: false });

function base(patch: Partial<GameView> = {}): GameView {
  return {
    viewer: { role: 'gm' },
    rules: {
      biome: 'dungeon', mazeDc: 15, escapeTarget: 5, riverWidth: 3, encounterAt: 2,
      obstacleJam: 3, rollMode: 'app', abilities: [],
    },
    seats: [],
    order: ['A', 'B'],
    turn: 0,
    round: 1,
    progress: 0,
    strikes: 0,
    advantage: [],
    phase: 'act',
    pending: null,
    revealed: null,
    outcome: null,
    river: [down(), down(), down()],
    deckCount: 20,
    discardCount: 0,
    discardTop: null,
    removedCount: 0,
    reserveIssued: 0,
    log: [],
    ...patch,
  };
}

const kinds = (prev: GameView, next: GameView) => plan(prev, next).map((s) => s.beat.kind);

describe('plan', () => {
  it('always ends on the truth', () => {
    const prev = base();
    const next = base({
      phase: 'act', turn: 1, progress: 1, discardCount: 1, discardTop: 'clear-path',
      river: [down(), down(), down()], deckCount: 19,
    });
    const steps = plan(prev, next);
    expect(steps[steps.length - 1]?.after).toEqual(next);
  });

  it('a pick is a reveal, then a sync that keeps the card held', () => {
    const prev = base({ phase: 'pick' });
    const next = base({
      phase: 'reveal',
      revealed: { slot: 1, category: 'clear-path', leavesRiver: true },
      river: [down(), up('clear-path'), down()],
    });
    expect(kinds(prev, next)).toEqual(['reveal', 'sync']);
    expect(plan(prev, next)[0]?.after.river[1]).toEqual(up('clear-path'));
  });

  it('a Clear Path resolving departs, scores, deals, then passes the turn', () => {
    const prev = base({
      phase: 'reveal',
      revealed: { slot: 1, category: 'clear-path', leavesRiver: true },
      river: [down(), up('clear-path'), down()],
    });
    const next = base({
      phase: 'act', turn: 1, progress: 1, deckCount: 19,
      discardCount: 1, discardTop: 'clear-path',
      river: [down(), down(), down()],
    });
    const steps = plan(prev, next);
    expect(steps.map((s) => s.beat.kind)).toEqual(['depart', 'progress', 'deal', 'turn']);
    // The slot empties as the card leaves, and the deal fills it.
    expect(steps[0]?.after.river[1]).toEqual(empty());
    expect(steps[0]?.after.discardTop).toBe('clear-path');
    expect(steps[1]?.after.progress).toBe(1);
    expect(steps[2]?.after.river[1]).toEqual(down());
    expect(steps[2]?.beat).toEqual({ kind: 'deal', slots: [1] });
    expect(steps[steps.length - 1]?.after).toEqual(next);
  });

  it('a Monster strikes rather than scores', () => {
    const prev = base({
      phase: 'reveal',
      revealed: { slot: 0, category: 'monster', leavesRiver: true },
      river: [up('monster'), down(), down()],
    });
    const next = base({
      phase: 'act', turn: 1, strikes: 1, deckCount: 19,
      discardCount: 1, discardTop: 'monster',
    });
    expect(kinds(prev, next)).toEqual(['depart', 'strike', 'deal', 'turn']);
  });

  it('a revealed Obstacle settles where it is', () => {
    const prev = base({
      phase: 'reveal',
      revealed: { slot: 2, category: 'obstacle', leavesRiver: false },
      river: [down(), down(), up('obstacle')],
    });
    const next = base({ phase: 'act', turn: 1, river: [down(), down(), up('obstacle')] });
    expect(kinds(prev, next)).toEqual(['settle', 'turn']);
  });

  it('a Wanderer that moves on later departs without a reveal', () => {
    const prev = base({ phase: 'choice', river: [down(), up('wanderer'), down()] });
    const next = base({
      phase: 'act', turn: 1, deckCount: 19, discardCount: 1, discardTop: 'wanderer',
    });
    expect(kinds(prev, next)).toEqual(['depart', 'deal', 'turn']);
  });

  it('Careful Consideration: one leaves, the other is turned back, not discarded', () => {
    const prev = base({ phase: 'choice', river: [up('item'), up('monster'), down()] });
    const next = base({
      phase: 'pick', discardCount: 1, discardTop: 'monster',
      river: [down(), down(), down()],
    });
    const steps = plan(prev, next);
    const departs = steps.filter((s) => s.beat.kind === 'depart');
    expect(departs).toHaveLength(1);
    expect(departs[0]?.beat).toEqual({ kind: 'depart', slot: 1, category: 'monster' });
    const deal = steps.find((s) => s.beat.kind === 'deal');
    expect(deal?.beat).toEqual({ kind: 'deal', slots: [0, 1] });
  });

  it('a forge adds to the discard without crossing the river', () => {
    const prev = base();
    const next = base({ discardCount: 2, discardTop: 'clear-path', reserveIssued: 2 });
    expect(kinds(prev, next)).toEqual(['discard', 'sync']);
  });

  it('a sweep departs every face-up card and deals three', () => {
    const prev = base({ river: [up('obstacle'), down(), up('obstacle')] });
    const next = base({
      phase: 'pick', discardCount: 3, discardTop: 'obstacle', deckCount: 17,
    });
    const k = kinds(prev, next);
    expect(k.filter((x) => x === 'depart')).toHaveLength(2);
    expect(plan(prev, next).find((s) => s.beat.kind === 'deal')?.beat)
      .toEqual({ kind: 'deal', slots: [0, 1, 2] });
  });

  it('an empty river with an empty deck stays empty', () => {
    const prev = base({
      phase: 'reveal', deckCount: 0,
      revealed: { slot: 0, category: 'item', leavesRiver: true },
      river: [up('item'), empty(), empty()],
    });
    const next = base({
      phase: 'act', turn: 1, deckCount: 0, discardCount: 1, discardTop: 'item',
      river: [empty(), empty(), empty()],
    });
    const steps = plan(prev, next);
    expect(steps.map((s) => s.beat.kind)).toEqual(['depart', 'turn']);
    expect(steps[0]?.after.river[0]).toEqual(empty());
  });

  it('an unchanged view is a single sync', () => {
    const v = base();
    expect(kinds(v, { ...v })).toEqual(['sync']);
  });

  it('a scout holds its three cards off the table, and the river is not re-dealt', () => {
    const prev = base({ phase: 'check' });
    const next = base({
      phase: 'choice', deckCount: 17,
      pending: { kind: 'choice', seatId: 'A', choice: { kind: 'scout-top', cards: ['item', 'monster', 'clear-path'] } },
    });
    expect(kinds(prev, next)).toEqual(['sync']);
  });
});

/* What the counts cannot say, read off the cues (DECISIONS O2). */
const line = (n: number, cue?: GameEvent['cue']): GameEvent => (
  cue ? { n, kind: 'sys', visibility: 'all', text: '', cue } : { n, kind: 'sys', visibility: 'all', text: '' }
);

describe('plan, with cues', () => {
  it('a jam: the third blocker lands, the river goes at once, a Monster is fed in, then the deal', () => {
    const prev = base({
      phase: 'reveal',
      revealed: { slot: 2, category: 'obstacle', leavesRiver: false },
      river: [up('obstacle'), up('obstacle'), up('obstacle')],
      deckCount: 15, discardCount: 5, discardTop: 'item',
      log: [line(1)],
    });
    const next = base({
      phase: 'act', turn: 1, deckCount: 12, discardCount: 9, discardTop: 'monster',
      log: [line(1), line(2), line(3, 'jam')],
    });
    const steps = plan(prev, next);
    expect(steps.map((s) => s.beat.kind)).toEqual(['settle', 'jam', 'feed', 'deal', 'turn']);
    expect(steps[1]?.beat).toEqual({ kind: 'jam', slots: [0, 1, 2], faces: ['obstacle', 'obstacle', 'obstacle'] });
    expect(steps[1]?.after.river).toEqual([empty(), empty(), empty()]);
    expect(steps[1]?.after.discardCount).toBe(8);
    expect(steps[2]?.after.discardTop).toBe('monster');
    expect(steps[2]?.after.discardCount).toBe(9);
    expect(steps[3]?.beat).toEqual({ kind: 'deal', slots: [0, 1, 2] });
    expect(steps[steps.length - 1]?.after).toEqual(next);
  });

  it('a jam behind a card that left: it goes alone first, and an unseen card goes as a back', () => {
    const prev = base({
      phase: 'reveal',
      revealed: { slot: 0, category: 'clear-path', leavesRiver: true },
      river: [up('clear-path'), up('obstacle'), down()],
      log: [line(1)],
    });
    const next = base({
      phase: 'act', turn: 1, progress: 1, deckCount: 16, discardCount: 5, discardTop: 'monster',
      log: [line(1), line(2), line(3, 'jam')],
    });
    const steps = plan(prev, next);
    expect(steps.map((s) => s.beat.kind)).toEqual(['depart', 'progress', 'jam', 'feed', 'deal', 'turn']);
    expect(steps[0]?.after.discardTop).toBe('clear-path');
    expect(steps[2]?.beat).toEqual({ kind: 'jam', slots: [1, 2], faces: ['obstacle', null] });
    expect(steps[steps.length - 1]?.after).toEqual(next);
  });

  it('a reshuffle: the card lands, the discard goes back into the deck, then the deal from it', () => {
    const prev = base({
      phase: 'reveal',
      revealed: { slot: 1, category: 'clear-path', leavesRiver: true },
      river: [down(), up('clear-path'), down()],
      deckCount: 0, discardCount: 6, discardTop: 'item',
      log: [line(1)],
    });
    const next = base({
      phase: 'act', turn: 1, progress: 1, deckCount: 6, discardCount: 0, discardTop: null,
      log: [line(1), line(2), line(3, 'reshuffle')],
    });
    const steps = plan(prev, next);
    expect(steps.map((s) => s.beat.kind)).toEqual(['depart', 'progress', 'reshuffle', 'deal', 'turn']);
    // Counted onto the pile as it lands, not jumped to the empty end.
    expect(steps[0]?.after.discardCount).toBe(7);
    expect(steps[0]?.after.discardTop).toBe('clear-path');
    expect(steps[2]?.beat).toEqual({ kind: 'reshuffle', count: 7 });
    expect(steps[2]?.after.discardCount).toBe(0);
    expect(steps[2]?.after.deckCount).toBe(7);
    expect(steps[3]?.after.deckCount).toBe(6);
    expect(steps[steps.length - 1]?.after).toEqual(next);
  });

  it('a reshuffle that came before a jam plays before it', () => {
    const prev = base({
      phase: 'reveal',
      revealed: { slot: 0, category: 'clear-path', leavesRiver: true },
      river: [up('clear-path'), up('obstacle'), up('obstacle')],
      deckCount: 0, discardCount: 3, discardTop: 'item',
      log: [line(1)],
    });
    const next = base({
      phase: 'act', turn: 1, progress: 1, deckCount: 0, discardCount: 4, discardTop: 'monster',
      log: [line(1), line(2), line(3, 'reshuffle'), line(4, 'jam')],
    });
    expect(kinds(prev, next)).toEqual(['depart', 'progress', 'reshuffle', 'jam', 'feed', 'deal', 'turn']);
  });

  it('found: the strike lands, then the dark, then the encounter', () => {
    const prev = base({
      phase: 'reveal', strikes: 1,
      revealed: { slot: 0, category: 'monster', leavesRiver: true },
      river: [up('monster'), down(), down()],
      log: [line(1)],
    });
    const next = base({
      phase: 'encounter', strikes: 2, deckCount: 19, discardCount: 1, discardTop: 'monster',
      log: [line(1), line(2), line(3, 'found')],
    });
    const steps = plan(prev, next);
    expect(steps.map((s) => s.beat.kind)).toEqual(['depart', 'strike', 'deal', 'found', 'sync']);
    expect(steps[2]?.after.phase).toBe('reveal');
    expect(steps[3]?.after.phase).toBe('encounter');
  });

  it('a cue already seen is not played again', () => {
    const v = base({ log: [line(1), line(2, 'jam')] });
    expect(kinds(v, { ...v, turn: 1 })).toEqual(['turn']);
  });

  it('the turn that wraps the table carries the new round', () => {
    const prev = base({ turn: 1 });
    const next = base({ turn: 0, round: 2 });
    expect(plan(prev, next).map((s) => s.beat)).toEqual([{ kind: 'turn', from: 'B', to: 'A', round: 2 }]);
    expect(plan(base(), base({ turn: 1 })).map((s) => s.beat)).toEqual([{ kind: 'turn', from: 'A', to: 'B' }]);
  });
});
