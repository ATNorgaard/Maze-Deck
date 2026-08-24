/* ============================================================
   Engine types.

   The deck composition is NOT redefined here — it is imported
   from the component library, which is the one place it lives.
   The import is relative on purpose: `packages/ui/src/types.ts`
   has no imports of its own, so nothing from React comes with
   it, and a relative path needs no alias config in vitest, in
   Vite, or in tsc.
   ============================================================ */

import type {
  AbilityKey, AbilityScore, CardCategory, ExpansionCategory,
} from '../../ui/src/types';
import type { RngState } from './rng';

export type { AbilityKey, AbilityScore, CardCategory, ExpansionCategory };

/** One character at the table. */
export interface Seat {
  id: string;
  name: string;
  /** Free text — the app never derives mechanics from it. */
  cls?: string;
  /** Ability modifiers, exactly as written on the player's own sheet. */
  mods: Record<AbilityScore, number>;
}

/** Who rolls the d20. The GM confirms the outcome either way. */
export type RollMode = 'app' | 'manual';

export interface RunConfig {
  seed: string;
  mazeDc: number;
  escapeTarget: number;
  riverWidth: number;
  encounterAt: number;
  /** Obstacles filling the river at once before it is cleared. */
  obstacleJam: number;
  rollMode: RollMode;
  /** Which actions this table is playing with. */
  abilities: AbilityKey[];
  /** Opt-in categories beyond the standard five. */
  expansions: ExpansionCategory[];
  /** Difficulty dials — extra copies mixed in at shuffle. */
  extraClearPath: number;
  extraMonster: number;
  seats: Seat[];
}

/** One position in the river. */
export interface Slot {
  category: CardCategory | null;
  /** Face-up cards are known to everyone. Obstacles stay face-up. */
  faceUp: boolean;
}

export type Phase =
  /** The active player owes an action. */
  | 'act'
  /** A roll is on the table, waiting for the GM to confirm it. */
  | 'check'
  /** An action resolved and needs a decision before it finishes. */
  | 'choice'
  /** The action is done; the player owes a pick from the river. */
  | 'pick'
  /** Strikes hit the limit. The table is running combat. */
  | 'encounter'
  | 'over';

export interface PendingCheck {
  kind: 'check';
  seatId: string;
  /** What the check is for, so applying it knows what to do. */
  reason:
    | { type: 'ability'; ability: AbilityKey }
    | { type: 'obstacle'; slot: number };
  score: AbilityScore;
  dc: number;
  mod: number;
  /** null in manual roll mode until the GM enters the die. */
  d20: number | null;
  /** The second die, when the check was made with advantage. */
  d20b: number | null;
  /** null until the die is known. The GM may overwrite it. */
  success: boolean | null;
  overridden: boolean;
}

/** A decision the engine cannot make on the player's behalf. */
export type Choice =
  /** Scout Ahead: three drawn, one goes back on top. */
  | { kind: 'scout-top'; cards: CardCategory[] }
  /** It's Elementary: two drawn, one replaces a river card. */
  | { kind: 'swap-river'; cards: CardCategory[] }
  /** Careful Consideration: two revealed, one is discarded. */
  | { kind: 'discard-revealed'; slots: number[] }
  /** Boost Morale: who gets the advantage. */
  | { kind: 'boost-target' }
  /** A Wanderer was taken. The GM says whether it lingers. */
  | { kind: 'wanderer-stays'; slot: number };

export interface PendingChoice {
  kind: 'choice';
  seatId: string;
  choice: Choice;
}

export type Pending = PendingCheck | PendingChoice;

export type ChoicePayload =
  | { kind: 'scout-top'; cardIndex: number }
  | { kind: 'swap-river'; cardIndex: number; slot: number }
  | { kind: 'discard-revealed'; slot: number }
  | { kind: 'boost-target'; seatId: string }
  | { kind: 'wanderer-stays'; stays: boolean };

export type GameAction =
  | { type: 'USE_ABILITY'; ability: AbilityKey }
  | { type: 'ATTEMPT_OBSTACLE'; slot: number; score: AbilityScore; dc?: number }
  /** Manual roll mode: the player rolled, the GM types it in. */
  | { type: 'ENTER_ROLL'; d20: number; d20b?: number }
  /** The GM lets the roll land, optionally overruling it. */
  | { type: 'CONFIRM_CHECK'; success?: boolean }
  | { type: 'RESOLVE_CHOICE'; payload: ChoicePayload }
  | { type: 'PICK_SLOT'; index: number }
  /** Combat happened at the table; this is the result coming back. */
  | { type: 'RESOLVE_ENCOUNTER'; won: boolean; endRun?: boolean }
  | { type: 'END_RUN' };

export type EventKind = 'sys' | 'good' | 'bad' | 'card' | 'muted';

/**
 * One line of the session log.
 *
 * `visibility` is the whole hidden-information model: 'gm' lines
 * name cards and never leave the server for a player's client.
 * Redaction happens before the wire, not in the UI.
 */
export interface GameEvent {
  n: number;
  kind: EventKind;
  visibility: 'all' | 'gm';
  text: string;
}

export type Outcome = 'through' | 'lost';

/** What the UI may offer in the current state. Derived, never stored. */
export interface Available {
  abilities: AbilityKey[];
  /** River slots holding something that can be attempted. */
  obstacleSlots: number[];
  /** River slots the active player may commit to. */
  pickSlots: number[];
  /** Manual roll mode is waiting for a die. */
  needsRoll: boolean;
  /** A rolled check is waiting for the GM to let it land. */
  needsConfirm: boolean;
  choice: Choice | null;
  encounter: boolean;
}

export interface GameState {
  config: RunConfig;
  rng: RngState;
  /** Top of the deck is the END of this array. */
  deck: CardCategory[];
  river: Slot[];
  discard: CardCategory[];
  /** Out of the game for good. Never reshuffled. */
  removed: CardCategory[];
  /** Cards brought in from outside the deck, for conservation checks. */
  reserveIssued: number;
  /** Seat ids in initiative order, rolled at run start. */
  order: string[];
  turn: number;
  round: number;
  progress: number;
  strikes: number;
  /** Seats holding an unspent advantage from Boost Morale. */
  advantage: string[];
  phase: Phase;
  pending: Pending | null;
  outcome: Outcome | null;
  log: GameEvent[];
}
