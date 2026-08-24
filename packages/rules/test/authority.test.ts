/* Who may send what. The engine does not care; the server must. */

import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine';
import { mayAct, mayAdvanceReveal } from '../src/authority';
import { isJoinCode, makeJoinCode, normaliseJoinCode } from '../src/protocol';
import { view } from '../src/view';
import { makeRun } from './harness';
import type { GameAction, GameState } from '../src/types';

const GM = { role: 'gm' } as const;
const seatOf = (g: GameState, i: number) => g.order[i] as string;
const asPlayer = (id: string) => ({ role: 'player', seatId: id } as const);
const v = (g: GameState) => view(g, GM);

describe('a player may only move on their own turn', () => {
  it('lets the active seat act', () => {
    const g = makeRun('turn');
    const active = seatOf(g, 0);
    expect(mayAct(v(g), asPlayer(active), { type: 'USE_ABILITY', ability: 'forge-a-path' }).ok)
      .toBe(true);
  });

  it('refuses everybody else', () => {
    const g = makeRun('turn');
    const other = seatOf(g, 1);
    const verdict = mayAct(v(g), asPlayer(other), { type: 'USE_ABILITY', ability: 'forge-a-path' });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/not your turn/i);
  });

  it('lets the GM act at any time', () => {
    const g = makeRun('turn');
    expect(mayAct(v(g), GM, { type: 'USE_ABILITY', ability: 'forge-a-path' }).ok).toBe(true);
  });
});

describe('what a player must never send', () => {
  /** A player who could confirm a check could pass everything they failed. */
  it('refuses CONFIRM_CHECK even on their own turn', () => {
    const g = makeRun('confirm');
    const started = apply(g, { type: 'USE_ABILITY', ability: 'forge-a-path' }).state;
    const active = seatOf(started, 0);

    const verdict = mayAct(v(started), asPlayer(active), { type: 'CONFIRM_CHECK', success: true });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/only the gm/i);
  });

  it('refuses the encounter result and ending the run', () => {
    const g = makeRun('gm-only');
    const active = seatOf(g, 0);
    const denied: GameAction[] = [
      { type: 'RESOLVE_ENCOUNTER', won: true },
      { type: 'END_RUN' },
    ];
    for (const action of denied) {
      expect(mayAct(v(g), asPlayer(active), action).ok).toBe(false);
      expect(mayAct(v(g), GM, action).ok).toBe(true);
    }
  });

  it('hands the Wanderer decision to the GM but leaves other choices with the player', () => {
    const g = makeRun('wanderer-auth');
    const active = seatOf(g, 0);

    expect(mayAct(v(g), asPlayer(active), {
      type: 'RESOLVE_CHOICE', payload: { kind: 'wanderer-stays', stays: true },
    }).ok).toBe(false);

    expect(mayAct(v(g), asPlayer(active), {
      type: 'RESOLVE_CHOICE', payload: { kind: 'scout-top', cardIndex: 0 },
    }).ok).toBe(true);
  });
});

describe('the reveal belongs to the server', () => {
  it('refuses ADVANCE_REVEAL from every client, GM included', () => {
    const g = makeRun('reveal-auth');
    for (const actor of [GM, asPlayer(seatOf(g, 0))]) {
      const verdict = mayAct(v(g), actor, { type: 'ADVANCE_REVEAL' });
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.reason).toMatch(/server/i);
    }
  });

  it('is idempotent: only advances while a card is actually revealed', () => {
    const g = structuredClone(makeRun('idem'));
    g.river = [
      { category: 'item', faceUp: false },
      { category: 'item', faceUp: false },
      { category: 'item', faceUp: false },
    ];
    g.phase = 'pick';

    const revealed = apply(g, { type: 'PICK_SLOT', index: 0 }).state;
    expect(mayAdvanceReveal(v(revealed))).toBe(true);

    const resolved = apply(revealed, { type: 'ADVANCE_REVEAL' }).state;
    // A second alarm, a reconnect, a duplicate timer: all refused.
    expect(mayAdvanceReveal(v(resolved))).toBe(false);
  });
});

describe('a closed run accepts nothing', () => {
  it('refuses every actor once the phase is over', () => {
    const g = structuredClone(makeRun('closed'));
    g.phase = 'over';
    g.outcome = 'through';
    for (const actor of [GM, asPlayer(seatOf(g, 0))]) {
      expect(mayAct(v(g), actor, { type: 'USE_ABILITY', ability: 'forge-a-path' }).ok)
        .toBe(false);
    }
  });
});

describe('join codes', () => {
  it('are six characters from an alphabet with no lookalikes', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = makeJoinCode();
      expect(code).toHaveLength(6);
      expect(isJoinCode(code)).toBe(true);
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('tidies a typed code without corrupting a correct one', () => {
    expect(normaliseJoinCode(' abc-234 ')).toBe('ABC234');
    const code = makeJoinCode();
    expect(normaliseJoinCode(code.toLowerCase())).toBe(code);
  });

  it('rejects anything that is not a code', () => {
    expect(isJoinCode('ABC')).toBe(false);
    expect(isJoinCode('ABCDEO')).toBe(false);
  });
});
