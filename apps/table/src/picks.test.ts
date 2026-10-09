/* The GM's chronicle draws a scene for every card turned, read off the
   log, so a device that polls and misses a reveal still gets one. */

import { describe, expect, it } from 'vitest';
import type { GameEvent, GameView, Turned } from '@maze-deck/rules';
import { picksIn, undrawn } from './picks';

const line = (n: number, turned?: Turned): GameEvent => (
  turned ? { n, kind: 'card', visibility: 'all', text: '', turned } : { n, kind: 'sys', visibility: 'all', text: '' }
);

/** Just what picks.ts reads off a view. */
const viewOf = (log: GameEvent[], at: Partial<GameView> = {}): GameView => ({
  log, phase: 'act', revealed: null, round: 2, progress: 3, order: ['wren', 'odalis'], turn: 1, ...at,
}) as unknown as GameView;

describe('picksIn', () => {
  it('reads every card turned, with who took it and when, as they were at the pick', () => {
    // The reveal is long over and the turn has passed to Odalis.
    const v = viewOf([
      line(4, { slot: 0, category: 'clear-path', seatId: 'wren', round: 1, progress: 0 }),
      line(5),
      line(9, { slot: 2, category: 'monster', seatId: 'wren', round: 2, progress: 1 }),
      line(10),
    ]);
    expect(picksIn(v)).toEqual([
      { key: '4:0', n: 4, category: 'clear-path', round: 1, seatId: 'wren', progress: 0 },
      { key: '9:2', n: 9, category: 'monster', round: 2, seatId: 'wren', progress: 1 },
    ]);
  });

  it('completes a mark without who and when from the view, as the chronicle always did', () => {
    const v = viewOf([line(7, { slot: 1, category: 'item' })]);
    expect(picksIn(v)).toEqual([{ key: '7:1', n: 7, category: 'item', round: 2, seatId: 'odalis', progress: 3 }]);
  });

  it('reads a reveal off the reveal itself on a log with no marks', () => {
    const v = viewOf([line(3), line(6)], { phase: 'reveal', revealed: { slot: 2, category: 'obstacle', leavesRiver: false } });
    expect(picksIn(v)).toEqual([{ key: '6:2', n: 6, category: 'obstacle', round: 2, seatId: 'odalis', progress: 3 }]);
  });

  it('does not count a marked reveal twice', () => {
    const v = viewOf([line(6, { slot: 2, category: 'obstacle', seatId: 'odalis', round: 2, progress: 3 })], {
      phase: 'reveal', revealed: { slot: 2, category: 'obstacle', leavesRiver: false },
    });
    expect(picksIn(v)).toHaveLength(1);
  });
});

describe('undrawn', () => {
  const log = [
    line(4, { slot: 0, category: 'clear-path', seatId: 'wren', round: 1, progress: 0 }),
    line(9, { slot: 2, category: 'item', seatId: 'odalis', round: 1, progress: 1 }),
    line(14, { slot: 1, category: 'monster', seatId: 'wren', round: 2, progress: 1 }),
  ];

  it('is the card just turned, on the GM\'s own device', () => {
    expect(undrawn(viewOf(log), [{ key: '4:0' }, { key: '9:2' }]).map((p) => p.key)).toEqual(['14:1']);
  });

  it('catches up on every reveal missed since the newest scene drawn', () => {
    expect(undrawn(viewOf(log), [{ key: '4:0' }]).map((p) => p.key)).toEqual(['9:2', '14:1']);
  });

  it('is nothing once every card has its scene, as after a reload', () => {
    expect(undrawn(viewOf(log), [{ key: '4:0' }, { key: '9:2' }, { key: '14:1' }])).toEqual([]);
  });

  it('is only the latest card on a device meeting a crossing already under way', () => {
    expect(undrawn(viewOf(log), []).map((p) => p.key)).toEqual(['14:1']);
  });

  it('does not reach back past the newest scene for one never drawn', () => {
    expect(undrawn(viewOf(log), [{ key: '9:2' }]).map((p) => p.key)).toEqual(['14:1']);
  });

  it('is nothing before any card has turned', () => {
    expect(undrawn(viewOf([line(1), line(2)]), [])).toEqual([]);
  });
});
