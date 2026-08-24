/* ============================================================
   What a client is allowed to know.

   `GameState` contains three things that must never reach a
   browser: the seed, the generator's state, and the deck's
   order. Any one of them lets a client compute every card the
   party is about to draw.

   So no client ever receives `GameState`. The server holds it and
   sends a `GameView` — this is the wire format, and building it is
   the redaction. Doing it here rather than in the UI is the whole
   point: a secret hidden by a React component is readable from the
   network tab in thirty seconds.

   Note what is NOT asymmetric. A face-down card is hidden from the
   GM too — they deal blind, same as everyone. The only thing the
   role gates is the log, because M3's scenario prompt is the GM's
   to read before they narrate it.
   ============================================================ */

import { getCategory } from '../../ui/src/types';
import type { AbilityKey, CardCategory } from '../../ui/src/types';
import type {
  Choice, GameEvent, GameState, Outcome, Pending, Phase, Revealed, RollMode, Seat,
} from './types';

export type Viewer =
  | { role: 'gm' }
  | { role: 'player'; seatId: string };

/** One river position, as a client is allowed to see it. */
export interface ViewSlot {
  /** The card, when it is face up. Null when face down OR empty. */
  category: CardCategory | null;
  faceUp: boolean;
  /** Whether anything is in the slot at all — face down still counts. */
  filled: boolean;
}

/** The run's settings. No seed. */
export interface ViewRules {
  mazeDc: number;
  escapeTarget: number;
  riverWidth: number;
  encounterAt: number;
  obstacleJam: number;
  rollMode: RollMode;
  abilities: AbilityKey[];
}

export interface GameView {
  viewer: Viewer;
  rules: ViewRules;
  seats: Seat[];
  order: string[];
  turn: number;
  round: number;
  progress: number;
  strikes: number;
  advantage: string[];
  phase: Phase;
  pending: Pending | null;
  revealed: Revealed | null;
  outcome: Outcome | null;
  river: ViewSlot[];
  /** Counts only. The contents stay on the server. */
  deckCount: number;
  discardCount: number;
  /** The discard is a face-up pile; its top card is public. */
  discardTop: CardCategory | null;
  removedCount: number;
  reserveIssued: number;
  log: GameEvent[];
}

/**
 * Build one client's view of the game.
 *
 * Everything here is an allow-list. Adding a field to `GameState`
 * does not leak it — you have to come here and let it through, which
 * is deliberate.
 */
export function view(state: GameState, viewer: Viewer): GameView {
  return {
    viewer,
    rules: {
      mazeDc: state.config.mazeDc,
      escapeTarget: state.config.escapeTarget,
      riverWidth: state.config.riverWidth,
      encounterAt: state.config.encounterAt,
      obstacleJam: state.config.obstacleJam,
      rollMode: state.config.rollMode,
      abilities: [...state.config.abilities],
    },
    seats: state.config.seats.map((s) => ({ ...s, mods: { ...s.mods } })),
    order: [...state.order],
    turn: state.turn,
    round: state.round,
    progress: state.progress,
    strikes: state.strikes,
    advantage: [...state.advantage],
    phase: state.phase,
    pending: state.pending ? structuredClone(state.pending) : null,
    revealed: state.revealed ? { ...state.revealed } : null,
    outcome: state.outcome,

    // A face-down card is not named to anybody, so the category is
    // dropped rather than merely flagged. `filled` is what the board
    // needs to tell "face down" from "empty".
    river: state.river.map((slot) => ({
      category: slot.faceUp ? slot.category : null,
      faceUp: slot.faceUp,
      filled: slot.category !== null,
    })),

    deckCount: state.deck.length,
    discardCount: state.discard.length,
    discardTop: state.discard.length
      ? state.discard[state.discard.length - 1] ?? null
      : null,
    removedCount: state.removed.length,
    reserveIssued: state.reserveIssued,

    log: viewer.role === 'gm'
      ? state.log.map((e) => ({ ...e }))
      : state.log.filter((e) => e.visibility === 'all').map((e) => ({ ...e })),
  };
}

/** Whose turn it is, from a view. */
export function activeSeatOf(v: GameView): Seat | null {
  if (v.order.length === 0) return null;
  const id = v.order[v.turn % v.order.length];
  return v.seats.find((s) => s.id === id) ?? null;
}

/** What the UI may offer, derived from a view rather than the state. */
export interface Available {
  abilities: AbilityKey[];
  obstacleSlots: number[];
  pickSlots: number[];
  needsRoll: boolean;
  needsConfirm: boolean;
  choice: Choice | null;
  encounter: boolean;
  revealed: Revealed | null;
}

export function availableFor(v: GameView): Available {
  const pending = v.pending;
  const isCheck = pending?.kind === 'check' ? pending : null;

  return {
    abilities: v.phase === 'act' ? [...v.rules.abilities] : [],
    // Only a card the table can see can be worked on, which is exactly
    // right: a blocker is face up by definition.
    obstacleSlots: v.phase === 'act'
      ? v.river.flatMap((s, i) =>
          s.category !== null && getCategory(s.category).blocker ? [i] : [])
      : [],
    pickSlots: v.phase === 'pick'
      ? v.river.flatMap((s, i) => (s.filled ? [i] : []))
      : [],
    needsRoll: isCheck !== null && isCheck.d20 === null,
    needsConfirm: isCheck !== null && isCheck.d20 !== null,
    choice: pending?.kind === 'choice' ? pending.choice : null,
    encounter: v.phase === 'encounter',
    revealed: v.phase === 'reveal' ? v.revealed : null,
  };
}
