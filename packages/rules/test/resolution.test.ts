/* What each category does when a player commits to it, and how a
   run ends. */

import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine';
import { makeRun } from './harness';
import type { CardCategory, GameState } from '../src/types';

/** A state with a known river, sitting in the pick phase. */
function atPick(
  seed: string,
  cards: (CardCategory | null)[],
  patch: Partial<GameState> = {},
): GameState {
  const g = structuredClone(makeRun(seed));
  g.river = cards.map((c) => ({ category: c, faceUp: false }));
  g.phase = 'pick';
  return Object.assign(g, patch);
}

/** Commit to a path and let the reveal advance, as the table would. */
function pick(g: GameState, index: number): GameState {
  const revealed = apply(g, { type: 'PICK_SLOT', index }).state;
  return apply(revealed, { type: 'ADVANCE_REVEAL' }).state;
}

describe('committing to a path', () => {
  it('Clear Path scores a point and clears the slot', () => {
    const g = atPick('clear', ['clear-path', 'item', 'item']);
    const after = pick(g, 0);

    expect(after.progress).toBe(1);
    expect(after.discard).toContain('clear-path');
    expect(after.river[0]?.category).not.toBeNull();
  });

  it('Monster takes a strike and is discarded', () => {
    const g = atPick('monster', ['monster', 'item', 'item']);
    const after = pick(g, 0);

    expect(after.strikes).toBe(1);
    expect(after.discard).toContain('monster');
    expect(after.phase).toBe('act');
  });

  it('Item is discarded either way', () => {
    const g = atPick('item', ['item', 'item', 'item']);
    const after = pick(g, 0);

    expect(after.discard).toContain('item');
    expect(after.phase).toBe('act');
  });

  it('Obstacle stays in the river, face up, and blocks the slot', () => {
    const g = atPick('obstacle', ['obstacle', 'item', 'item']);
    const after = pick(g, 0);

    expect(after.river[0]?.category).toBe('obstacle');
    expect(after.river[0]?.faceUp).toBe(true);
    expect(after.discard).not.toContain('obstacle');
    expect(after.phase).toBe('act');
  });

  it('Wanderer waits on the GM to say whether they linger', () => {
    const g = atPick('wanderer', ['wanderer', 'item', 'item']);
    const after = pick(g, 0);

    expect(after.phase).toBe('choice');
    const choice = after.pending?.kind === 'choice' ? after.pending.choice : null;
    expect(choice?.kind).toBe('wanderer-stays');

    const stayed = apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'wanderer-stays', stays: true },
    }).state;
    expect(stayed.river[0]?.category).toBe('wanderer');
    expect(stayed.river[0]?.faceUp).toBe(true);

    const left = apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'wanderer-stays', stays: false },
    }).state;
    expect(left.discard).toContain('wanderer');
    expect(left.river[0]?.category).not.toBe('wanderer');
  });

  it('will not let a player pick before taking an action', () => {
    const g = makeRun('too-early');
    expect(() => apply(g, { type: 'PICK_SLOT', index: 0 }))
      .toThrow(/Take an action/);
  });
});

describe('three blocked paths at once', () => {
  it('clears the river and sends an extra Monster to the discard', () => {
    const g = atPick('jam', ['obstacle', 'obstacle', 'obstacle']);
    g.river[0] = { category: 'obstacle', faceUp: true };
    g.river[1] = { category: 'obstacle', faceUp: true };

    const before = g.discard.filter((c) => c === 'monster').length;
    const after = pick(g, 2);

    expect(after.discard.filter((c) => c === 'monster').length).toBe(before + 1);
    expect(after.reserveIssued).toBe(g.reserveIssued + 1);
    // The Monster goes to the discard, never straight into the river.
    expect(after.river.every((s) => s.category !== 'monster' || !s.faceUp)).toBe(true);
    expect(after.strikes).toBe(0);
    expect(after.river.filter((s) => s.category === 'obstacle' && s.faceUp)).toHaveLength(0);
  });
});

describe('how a run ends', () => {
  it('reaching the target ends it as "through"', () => {
    const g = atPick('through', ['clear-path', 'item', 'item'], { progress: 4 });
    const after = pick(g, 0);

    expect(after.progress).toBe(5);
    expect(after.outcome).toBe('through');
    expect(after.phase).toBe('over');
  });

  it('a second strike hands the scene to the table', () => {
    const g = atPick('found', ['monster', 'item', 'item'], { strikes: 1 });
    const after = pick(g, 0);

    expect(after.phase).toBe('encounter');
    expect(after.outcome).toBeNull();
  });

  it('winning the encounter removes a Monster for good and resumes', () => {
    const g = atPick('won', ['monster', 'item', 'item'], { strikes: 1 });
    const fought = pick(g, 0);
    const after = apply(fought, { type: 'RESOLVE_ENCOUNTER', won: true }).state;

    expect(after.removed).toContain('monster');
    expect(after.strikes).toBe(0);
    expect(after.phase).toBe('act');
    expect(after.outcome).toBeNull();
  });

  it('losing it only ends the run when the GM says so', () => {
    const g = atPick('lost', ['monster', 'item', 'item'], { strikes: 1 });
    const fought = pick(g, 0);

    const carriedOn = apply(fought, { type: 'RESOLVE_ENCOUNTER', won: false }).state;
    expect(carriedOn.phase).toBe('act');
    expect(carriedOn.outcome).toBeNull();

    const ended = apply(fought, { type: 'RESOLVE_ENCOUNTER', won: false, endRun: true }).state;
    expect(ended.outcome).toBe('lost');
    expect(ended.phase).toBe('over');
  });

  it('refuses everything once it is over', () => {
    const g = atPick('closed', ['clear-path', 'item', 'item'], { progress: 4 });
    const over = pick(g, 0);
    expect(() => apply(over, { type: 'USE_ABILITY', ability: 'forge-a-path' }))
      .toThrow(/run is over/);
  });
});

describe('what the table sees', () => {
  it('names the card to everyone the moment it is committed to', () => {
    const g = atPick('open', ['item', 'wanderer', 'monster']);
    const { state, events } = apply(g, { type: 'PICK_SLOT', index: 0 });

    expect(state.phase).toBe('reveal');
    expect(events.every((e) => e.visibility === 'all')).toBe(true);
    expect(events.some((e) => e.text.includes('Item'))).toBe(true);
  });

  it('makes a deck peek public too', () => {
    const g = makeRun('open-scout');
    const used = apply(g, { type: 'USE_ABILITY', ability: 'scout-ahead' }).state;
    const after = apply(used, { type: 'CONFIRM_CHECK', success: true }).state;
    const { events } = apply(after, {
      type: 'RESOLVE_CHOICE', payload: { kind: 'scout-top', cardIndex: 0 },
    });

    const named = events.filter((e) => e.text.includes('on top of the deck'));
    expect(named.length).toBeGreaterThan(0);
    expect(named.every((e) => e.visibility === 'all')).toBe(true);
  });

  it('announces a card turned face up in the river to everyone', () => {
    const g = makeRun('open-reveal');
    const used = apply(g, { type: 'USE_ABILITY', ability: 'careful-consideration' }).state;
    const { events } = apply(used, { type: 'CONFIRM_CHECK', success: true });

    const revealed = events.filter((e) => e.text.startsWith('Revealed:'));
    expect(revealed.length).toBeGreaterThan(0);
    expect(revealed.every((e) => e.visibility === 'all')).toBe(true);
  });

  it('still never exposes a face-down river card', () => {
    const g = makeRun('face-down');
    // The categories are in state for the GM's screen, but no event
    // has ever named one. That is what M4 must strip per client.
    expect(g.river.every((s) => !s.faceUp)).toBe(true);
    expect(g.log.every((e) => !/Clear Path|Monster|Obstacle|Wanderer|Item/.test(e.text))).toBe(true);
  });
});

describe('the reveal beat', () => {
  it('holds the card face up before anything resolves', () => {
    const g = atPick('beat', ['clear-path', 'item', 'item']);
    const revealed = apply(g, { type: 'PICK_SLOT', index: 0 }).state;

    expect(revealed.phase).toBe('reveal');
    expect(revealed.revealed).toEqual({ slot: 0, category: 'clear-path', leavesRiver: true });
    expect(revealed.river[0]?.faceUp).toBe(true);
    // Nothing has happened yet.
    expect(revealed.progress).toBe(0);
    expect(revealed.discard).not.toContain('clear-path');

    const done = apply(revealed, { type: 'ADVANCE_REVEAL' }).state;
    expect(done.progress).toBe(1);
    expect(done.revealed).toBeNull();
  });

  it('marks a blocker as staying in the river', () => {
    const g = atPick('beat-block', ['obstacle', 'item', 'item']);
    const revealed = apply(g, { type: 'PICK_SLOT', index: 0 }).state;
    expect(revealed.revealed?.leavesRiver).toBe(false);
  });

  it('refuses to advance when nothing is being revealed', () => {
    const g = atPick('beat-none', ['item', 'item', 'item']);
    expect(() => apply(g, { type: 'ADVANCE_REVEAL' })).toThrow(/being revealed/);
  });
});
