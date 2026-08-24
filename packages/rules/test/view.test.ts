/* Redaction. These are the security tests: everything else in this
   suite protects the rules, this file protects the secrets. */

import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine';
import { view } from '../src/view';
import { makeRun, playOut } from './harness';
import type { GameState } from '../src/types';

const GM = { role: 'gm' } as const;
const PLAYER = { role: 'player', seatId: 'A' } as const;

const SEEDS = Array.from({ length: 60 }, (_, i) => `view-${i}`);

describe('what never leaves the server', () => {
  it('omits the seed, the generator and the deck from every view', () => {
    for (const viewer of [GM, PLAYER]) {
      const g = makeRun('secrets');
      const wire = JSON.stringify(view(g, viewer));

      expect(wire).not.toContain('secrets');   // the seed itself
      expect(wire).not.toContain('"rng"');
      expect(wire).not.toContain('"deck"');
      expect(wire).not.toContain('"seed"');
      expect(wire).not.toContain('"config"');
      // The counts are there instead.
      expect(JSON.parse(wire).deckCount).toBe(g.deck.length);
    }
  });

  it('never names a face-down card, to anybody', () => {
    for (const seed of SEEDS) {
      const played = playOut(makeRun(seed), `p-${seed}`);
      for (const state of played.states) {
        for (const viewer of [GM, PLAYER]) {
          const v = view(state, viewer);
          state.river.forEach((slot, i) => {
            const shown = v.river[i];
            if (!slot.faceUp) {
              expect(shown?.category).toBeNull();
              // But the board still knows whether the slot is occupied.
              expect(shown?.filled).toBe(slot.category !== null);
            } else {
              expect(shown?.category).toBe(slot.category);
            }
          });
        }
      }
    }
  });

  /**
   * The real property. Two games that differ ONLY in what is hidden
   * must produce byte-identical views — if they do not, the difference
   * is observable and the secret has leaked.
   */
  it('is indistinguishable between states that differ only in hidden cards', () => {
    for (const seed of SEEDS.slice(0, 25)) {
      const played = playOut(makeRun(seed), `p-${seed}`);

      for (const state of played.states) {
        const twin: GameState = structuredClone(state);
        // Rewrite every secret: the deck's order and contents, the
        // generator, the seed, and every face-down card in the river.
        twin.deck = twin.deck.map(() => 'monster');
        twin.deck.reverse();
        twin.rng = { s: 12345 };
        twin.config = { ...twin.config, seed: 'a completely different seed' };
        twin.river = twin.river.map((slot) =>
          (slot.faceUp || slot.category === null
            ? slot
            : { ...slot, category: 'monster' }));

        for (const viewer of [GM, PLAYER]) {
          expect(JSON.stringify(view(twin, viewer)))
            .toBe(JSON.stringify(view(state, viewer)));
        }
      }
    }
  });
});

describe('what the role changes', () => {
  it('gives a player only the public log', () => {
    const g = makeRun('log-split');
    const seeded: GameState = structuredClone(g);
    seeded.log.push(
      { n: 98, kind: 'card', visibility: 'gm', text: 'A secret worth keeping' },
      { n: 99, kind: 'sys', visibility: 'all', text: 'Something everyone saw' },
    );

    const gm = view(seeded, GM);
    const player = view(seeded, PLAYER);

    expect(gm.log.some((e) => e.text === 'A secret worth keeping')).toBe(true);
    expect(player.log.some((e) => e.text === 'A secret worth keeping')).toBe(false);
    expect(player.log.some((e) => e.text === 'Something everyone saw')).toBe(true);
  });

  it('changes nothing else at all', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const played = playOut(makeRun(seed), `p-${seed}`);
      for (const state of played.states) {
        const gm = { ...view(state, GM), log: [], viewer: null };
        const player = { ...view(state, PLAYER), log: [], viewer: null };
        // Everything but the log and the viewer stamp is common.
        expect(JSON.stringify(player)).toBe(JSON.stringify(gm));
      }
    }
  });
});

describe('what a client still needs', () => {
  it('carries the public board state', () => {
    const g = makeRun('board');
    const v = view(g, PLAYER);

    expect(v.river).toHaveLength(g.config.riverWidth);
    expect(v.rules.mazeDc).toBe(g.config.mazeDc);
    expect(v.rules.escapeTarget).toBe(g.config.escapeTarget);
    expect(v.seats).toHaveLength(g.config.seats.length);
    expect(v.order).toEqual(g.order);
    expect(v.deckCount).toBeGreaterThan(0);
  });

  it('shows the discard pile’s top card once there is one', () => {
    const g = makeRun('discard');
    expect(view(g, PLAYER).discardTop).toBeNull();

    const used = apply(g, { type: 'USE_ABILITY', ability: 'forge-a-path' }).state;
    const done = apply(used, { type: 'CONFIRM_CHECK', success: true }).state;

    expect(view(done, PLAYER).discardTop).toBe('clear-path');
    expect(view(done, PLAYER).discardCount).toBe(2);
  });

  it('shows a revealed card to everyone', () => {
    const g = structuredClone(makeRun('reveal-view'));
    g.river = [
      { category: 'item', faceUp: false },
      { category: 'item', faceUp: false },
      { category: 'item', faceUp: false },
    ];
    g.phase = 'pick';

    const revealed = apply(g, { type: 'PICK_SLOT', index: 0 }).state;
    const v = view(revealed, PLAYER);

    expect(v.revealed?.category).toBe('item');
    expect(v.river[0]?.category).toBe('item');
    expect(v.river[1]?.category).toBeNull();
  });
});
