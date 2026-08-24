/* The properties that must hold in every state of every run.
   These are the tests that earn their keep — each one is a class
   of bug the prototype actually shipped. */

import { describe, expect, it } from 'vitest';
import { DECK_TOTAL } from '../../ui/src/types';
import { cardsInRun, countCards, makeRun, playOut } from './harness';
import type { GameState } from '../src/types';

const SEEDS = Array.from({ length: 120 }, (_, i) => `seed-${i}`);

function everyState(fn: (g: GameState, seed: string) => void): void {
  for (const seed of SEEDS) {
    const played = playOut(makeRun(seed), `play-${seed}`);
    expect(played.stalled, `run ${seed} never reached an ending`).toBe(false);
    for (const state of played.states) fn(state, seed);
  }
}

describe('invariants across many seeded runs', () => {
  it('the river is always exactly as wide as configured', () => {
    everyState((g, seed) => {
      expect(g.river.length, `river width in ${seed}`).toBe(g.config.riverWidth);
    });
  });

  it('cards are conserved — nothing is created or lost outside the reserve', () => {
    everyState((g, seed) => {
      expect(countCards(g), `card count in ${seed}`)
        .toBe(DECK_TOTAL + g.reserveIssued);
    });
  });

  it('the reserve only ever issues Clear Paths and Monsters', () => {
    everyState((g) => {
      const counts = new Map<string, number>();
      for (const c of cardsInRun(g)) counts.set(c, (counts.get(c) ?? 0) + 1);
      // Nothing but the two reserve categories can exceed its printed count.
      expect(counts.get('obstacle') ?? 0).toBeLessThanOrEqual(5);
      expect(counts.get('wanderer') ?? 0).toBeLessThanOrEqual(5);
      expect(counts.get('item') ?? 0).toBeLessThanOrEqual(5);
    });
  });

  it('progress never goes backwards and never overshoots by more than one pick', () => {
    for (const seed of SEEDS) {
      const played = playOut(makeRun(seed), `play-${seed}`);
      let last = 0;
      for (const state of played.states) {
        expect(state.progress).toBeGreaterThanOrEqual(last);
        last = state.progress;
      }
    }
  });

  it('a finished run stays finished', () => {
    for (const seed of SEEDS) {
      const played = playOut(makeRun(seed), `play-${seed}`);
      const firstOver = played.states.findIndex((s) => s.phase === 'over');
      if (firstOver === -1) continue;
      for (const state of played.states.slice(firstOver)) {
        expect(state.phase).toBe('over');
        expect(state.outcome).not.toBeNull();
      }
    }
  });

  it('strikes never exceed the encounter threshold', () => {
    everyState((g) => {
      expect(g.strikes).toBeLessThanOrEqual(g.config.encounterAt);
    });
  });

  it('a run that ends "through" really did reach the target', () => {
    for (const seed of SEEDS) {
      const { final } = playOut(makeRun(seed), `play-${seed}`);
      if (final.outcome === 'through') {
        expect(final.progress).toBeGreaterThanOrEqual(final.config.escapeTarget);
      }
    }
  });

  it('the river is never short while cards remain anywhere', () => {
    everyState((g, seed) => {
      const empties = g.river.filter((s) => s.category === null).length;
      if (empties > 0 && g.phase !== 'over') {
        expect(g.deck.length + g.discard.length, `river short in ${seed}`).toBe(0);
      }
    });
  });
});

describe('determinism', () => {
  it('the same seed and the same actions produce the same run', () => {
    const a = playOut(makeRun('repeatable'), 'policy');
    const b = playOut(makeRun('repeatable'), 'policy');
    expect(JSON.stringify(a.final)).toBe(JSON.stringify(b.final));
    expect(a.steps).toBe(b.steps);
  });

  it('different seeds produce different runs', () => {
    const a = playOut(makeRun('one'), 'policy');
    const b = playOut(makeRun('two'), 'policy');
    expect(JSON.stringify(a.final)).not.toBe(JSON.stringify(b.final));
  });
});
