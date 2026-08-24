/* Shared test helpers: build a run, and play one to the end. */

import { apply, available, createGame, defaultConfig } from '../src/engine';
import { int, seedFrom } from '../src/rng';
import type { RngState } from '../src/rng';
import type {
  AbilityScore, CardCategory, GameAction, GameState, RunConfig, Seat,
} from '../src/types';

const SCORES: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export function seat(id: string, mod = 2): Seat {
  const mods = Object.fromEntries(SCORES.map((s) => [s, mod])) as Record<AbilityScore, number>;
  return { id, name: id, cls: 'Tester', mods };
}

export function makeRun(
  seed: string,
  overrides: Partial<RunConfig> = {},
  seats: Seat[] = [seat('A'), seat('B'), seat('C')],
): GameState {
  return createGame({ ...defaultConfig(seed, seats), ...overrides });
}

/**
 * Every card the run is holding, wherever it currently is —
 * including cards a pending decision is holding off-table, which
 * is the one place they can hide from the conservation check.
 */
export function countCards(g: GameState): number {
  let held = 0;
  if (g.pending?.kind === 'choice') {
    const c = g.pending.choice;
    if (c.kind === 'scout-top' || c.kind === 'swap-river') held = c.cards.length;
  }
  return (
    g.deck.length +
    g.discard.length +
    g.removed.length +
    g.river.filter((s) => s.category !== null).length +
    held
  );
}

export function cardsInRun(g: GameState): CardCategory[] {
  const held: CardCategory[] = g.pending?.kind === 'choice'
    && (g.pending.choice.kind === 'scout-top' || g.pending.choice.kind === 'swap-river')
    ? g.pending.choice.cards
    : [];
  return [
    ...g.deck,
    ...g.discard,
    ...g.removed,
    ...g.river.flatMap((s) => (s.category === null ? [] : [s.category])),
    ...held,
  ];
}

/** One legal action for whatever the state is waiting on. */
export function nextAction(g: GameState, rng: RngState): GameAction | null {
  const a = available(g);

  switch (g.phase) {
    case 'act': {
      // Attempt a blocked path sometimes, so that branch gets exercised.
      if (a.obstacleSlots.length > 0 && int(rng, 3) === 0) {
        const slot = a.obstacleSlots[int(rng, a.obstacleSlots.length)] as number;
        return { type: 'ATTEMPT_OBSTACLE', slot, score: 'STR' };
      }
      const ability = a.abilities[int(rng, a.abilities.length)];
      return ability ? { type: 'USE_ABILITY', ability } : null;
    }

    case 'check':
      if (a.needsRoll) return { type: 'ENTER_ROLL', d20: int(rng, 20) + 1 };
      return { type: 'CONFIRM_CHECK' };

    case 'choice': {
      const c = a.choice;
      if (!c) return null;
      switch (c.kind) {
        case 'scout-top':
          return { type: 'RESOLVE_CHOICE', payload: { kind: 'scout-top', cardIndex: int(rng, c.cards.length) } };
        case 'swap-river': {
          const slots = g.river.flatMap((s, i) => (s.category !== null ? [i] : []));
          const slot = slots[int(rng, slots.length)] ?? 0;
          return { type: 'RESOLVE_CHOICE', payload: { kind: 'swap-river', cardIndex: int(rng, c.cards.length), slot } };
        }
        case 'discard-revealed': {
          const slot = c.slots[int(rng, c.slots.length)] as number;
          return { type: 'RESOLVE_CHOICE', payload: { kind: 'discard-revealed', slot } };
        }
        case 'boost-target': {
          const id = g.order[int(rng, g.order.length)] as string;
          return { type: 'RESOLVE_CHOICE', payload: { kind: 'boost-target', seatId: id } };
        }
        case 'wanderer-stays':
          return { type: 'RESOLVE_CHOICE', payload: { kind: 'wanderer-stays', stays: int(rng, 2) === 0 } };
      }
      return null;
    }

    case 'pick': {
      if (a.pickSlots.length === 0) return null;
      const index = a.pickSlots[int(rng, a.pickSlots.length)] as number;
      return { type: 'PICK_SLOT', index };
    }

    // The reveal is a beat for the table, not a decision.
    case 'reveal':
      return { type: 'ADVANCE_REVEAL' };

    case 'encounter':
      return { type: 'RESOLVE_ENCOUNTER', won: int(rng, 4) > 0 };

    case 'over':
      return null;
  }
}

export interface Played {
  final: GameState;
  states: GameState[];
  steps: number;
  stalled: boolean;
}

/** Play a run to its end, or until the step cap trips. */
export function playOut(g: GameState, seed: string, cap = 4000): Played {
  const rng = seedFrom(seed);
  const states: GameState[] = [g];
  let current = g;
  let steps = 0;

  while (current.phase !== 'over' && steps < cap) {
    const action = nextAction(current, rng);
    // A state with no legal action and no ending is a wedged game.
    if (!action) return { final: current, states, steps, stalled: true };
    current = apply(current, action).state;
    states.push(current);
    steps += 1;
  }

  return { final: current, states, steps, stalled: current.phase !== 'over' };
}
