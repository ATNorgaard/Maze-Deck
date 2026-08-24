/* One test per action, driving the check to a known outcome with
   the GM confirmation rather than the dice. */

import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine';
import { makeRun } from './harness';
import type { AbilityKey, CardCategory, GameState } from '../src/types';

/** Force an action through to its effect, succeeding or failing. */
function act(g: GameState, ability: AbilityKey, success = true): GameState {
  const used = apply(g, { type: 'USE_ABILITY', ability }).state;
  return apply(used, { type: 'CONFIRM_CHECK', success }).state;
}

function river(g: GameState, cards: (CardCategory | null)[], faceUp = false): GameState {
  const next = structuredClone(g);
  next.river = cards.map((c) => ({ category: c, faceUp: c === null ? false : faceUp }));
  return next;
}

function countIn(list: CardCategory[], card: CardCategory): number {
  return list.filter((c) => c === card).length;
}

describe('Forge a Path (STR)', () => {
  it('puts two Clear Paths into the discard, not the deck', () => {
    const g = makeRun('forge');
    const before = countIn(g.discard, 'clear-path');
    const after = act(g, 'forge-a-path');

    expect(countIn(after.discard, 'clear-path')).toBe(before + 2);
    expect(after.reserveIssued).toBe(g.reserveIssued + 2);
    // The delayed-reward rule: they must not be drawable this cycle.
    expect(countIn(after.deck, 'clear-path')).toBe(countIn(g.deck, 'clear-path'));
    expect(after.phase).toBe('pick');
  });

  it('does nothing at all on a failed check', () => {
    const g = makeRun('forge-fail');
    const after = act(g, 'forge-a-path', false);
    expect(after.discard).toEqual(g.discard);
    expect(after.reserveIssued).toBe(0);
    expect(after.phase).toBe('pick');
  });
});

describe('Scout Ahead (DEX)', () => {
  it('draws three and lets one be set on top of the deck', () => {
    const g = makeRun('scout');
    const after = act(g, 'scout-ahead');

    expect(after.phase).toBe('choice');
    expect(after.pending?.kind).toBe('choice');
    const choice = after.pending?.kind === 'choice' ? after.pending.choice : null;
    expect(choice?.kind).toBe('scout-top');
    if (choice?.kind !== 'scout-top') throw new Error('wrong choice');
    expect(choice.cards).toHaveLength(3);
    expect(after.deck).toHaveLength(g.deck.length - 3);

    const chosen = choice.cards[1] as CardCategory;
    const done = apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'scout-top', cardIndex: 1 },
    }).state;

    expect(done.deck[done.deck.length - 1]).toBe(chosen);
    expect(done.deck).toHaveLength(g.deck.length);
    expect(done.phase).toBe('pick');
  });
});

describe('Steel Yourself (CON)', () => {
  it('sweeps the whole river into the discard and deals fresh', () => {
    const g = river(makeRun('steel'), ['obstacle', 'obstacle', 'item'], true);
    const after = act(g, 'steel-yourself');

    expect(countIn(after.discard, 'obstacle')).toBe(2);
    expect(countIn(after.discard, 'item')).toBe(1);
    expect(after.river.every((s) => s.category !== null)).toBe(true);
    expect(after.river.every((s) => !s.faceUp)).toBe(true);
    expect(after.phase).toBe('pick');
  });
});

describe("It's Elementary (INT)", () => {
  it('swaps a drawn card into the river and discards what it displaced', () => {
    const g = river(makeRun('elementary'), ['obstacle', 'item', 'wanderer'], true);
    const after = act(g, 'its-elementary');

    const choice = after.pending?.kind === 'choice' ? after.pending.choice : null;
    if (choice?.kind !== 'swap-river') throw new Error('expected a swap');
    const chosen = choice.cards[0] as CardCategory;

    const done = apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'swap-river', cardIndex: 0, slot: 0 },
    }).state;

    expect(done.river[0]?.category).toBe(chosen);
    expect(done.river[0]?.faceUp).toBe(false);
    expect(countIn(done.discard, 'obstacle')).toBe(1);
    expect(done.phase).toBe('pick');
  });
});

describe('Careful Consideration (WIS)', () => {
  it('reveals two, discards one, and turns the rest back down', () => {
    const g = river(makeRun('careful'), ['item', 'wanderer', 'monster']);
    const after = act(g, 'careful-consideration');

    const choice = after.pending?.kind === 'choice' ? after.pending.choice : null;
    if (choice?.kind !== 'discard-revealed') throw new Error('expected a reveal');
    expect(choice.slots).toEqual([0, 1]);
    expect(after.river[0]?.faceUp).toBe(true);
    expect(after.river[1]?.faceUp).toBe(true);

    const done = apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'discard-revealed', slot: 0 },
    }).state;

    expect(countIn(done.discard, 'item')).toBe(1);
    expect(done.river).toHaveLength(3);
    expect(done.river.every((s) => s.category !== null)).toBe(true);
    // Nothing non-blocking is left showing.
    expect(done.river.every((s) => !s.faceUp)).toBe(true);
    expect(done.phase).toBe('pick');
  });

  it('rejects a slot that was not one of the revealed pair', () => {
    const g = river(makeRun('careful-bad'), ['item', 'wanderer', 'monster']);
    const after = act(g, 'careful-consideration');
    expect(() => apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'discard-revealed', slot: 2 },
    })).toThrow(/revealed pair/);
  });
});

describe('Boost Morale (CHA)', () => {
  it('grants the advantage to the chosen seat', () => {
    const g = makeRun('boost');
    const after = act(g, 'boost-morale');
    const target = g.order[1] as string;

    const done = apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'boost-target', seatId: target },
    }).state;

    expect(done.advantage).toContain(target);
    expect(done.phase).toBe('pick');
  });

  it('spends it on that seat’s next check, rolling a second die', () => {
    const g = makeRun('boost-spend');
    const primed = structuredClone(g);
    primed.advantage = [primed.order[primed.turn] as string];

    const rolled = apply(primed, { type: 'USE_ABILITY', ability: 'forge-a-path' }).state;
    const check = rolled.pending?.kind === 'check' ? rolled.pending : null;

    expect(check?.d20b).not.toBeNull();
    expect(rolled.advantage).toHaveLength(0);
  });

  it('leaves an unboosted check on a single die', () => {
    const g = makeRun('boost-none');
    const rolled = apply(g, { type: 'USE_ABILITY', ability: 'forge-a-path' }).state;
    const check = rolled.pending?.kind === 'check' ? rolled.pending : null;
    expect(check?.d20b).toBeNull();
  });
});

describe('attempting a blocked path', () => {
  it('clears the Obstacle on a success and refills the slot', () => {
    const g = river(makeRun('obstacle'), ['obstacle', 'item', 'item'], true);
    const started = apply(g, { type: 'ATTEMPT_OBSTACLE', slot: 0, score: 'STR' }).state;
    const done = apply(started, { type: 'CONFIRM_CHECK', success: true }).state;

    expect(countIn(done.discard, 'obstacle')).toBe(1);
    expect(done.river[0]?.category).not.toBe('obstacle');
    expect(done.river[0]?.category).not.toBeNull();
    expect(done.phase).toBe('pick');
  });

  it('leaves it in place on a failure', () => {
    const g = river(makeRun('obstacle-fail'), ['obstacle', 'item', 'item'], true);
    const started = apply(g, { type: 'ATTEMPT_OBSTACLE', slot: 0, score: 'STR' }).state;
    const done = apply(started, { type: 'CONFIRM_CHECK', success: false }).state;

    expect(done.river[0]?.category).toBe('obstacle');
    expect(done.phase).toBe('pick');
  });

  it('refuses a slot with nothing blocking it', () => {
    const g = river(makeRun('obstacle-none'), ['item', 'item', 'item'], true);
    expect(() => apply(g, { type: 'ATTEMPT_OBSTACLE', slot: 0, score: 'STR' }))
      .toThrow(/Nothing blocking/);
  });
});

describe('the GM has the final word', () => {
  it('can overturn a rolled result, and the log says so', () => {
    const g = makeRun('override');
    const used = apply(g, { type: 'USE_ABILITY', ability: 'forge-a-path' }).state;
    const rolled = used.pending?.kind === 'check' ? used.pending.success : null;
    const done = apply(used, { type: 'CONFIRM_CHECK', success: !rolled }).state;

    expect(done.log.some((e) => e.text.includes('the GM rules otherwise'))).toBe(true);
  });
});

describe('manual roll mode', () => {
  it('waits for a die, then resolves against the DC', () => {
    const g = makeRun('manual', { rollMode: 'manual', mazeDc: 15 });
    const used = apply(g, { type: 'USE_ABILITY', ability: 'forge-a-path' }).state;
    const check = used.pending?.kind === 'check' ? used.pending : null;
    expect(check?.d20).toBeNull();
    expect(() => apply(used, { type: 'CONFIRM_CHECK' })).toThrow(/not been rolled/);

    // Seats carry +2, so 13 clears a DC of 15 exactly.
    const entered = apply(used, { type: 'ENTER_ROLL', d20: 13 }).state;
    const after = entered.pending?.kind === 'check' ? entered.pending : null;
    expect(after?.success).toBe(true);

    expect(() => apply(used, { type: 'ENTER_ROLL', d20: 21 })).toThrow(/1 to 20/);
  });
});
