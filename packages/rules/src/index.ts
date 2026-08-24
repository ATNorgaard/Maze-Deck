/* Maze Deck — the engine. */

export {
  IllegalActionError,
  activeSeat,
  apply,
  available,
  createGame,
  defaultConfig,
} from './engine';
export type { ApplyResult } from './engine';

export { d, int, next, seedFrom, shuffle } from './rng';
export type { RngState } from './rng';

export type {
  AbilityKey,
  AbilityScore,
  Available,
  CardCategory,
  Choice,
  ChoicePayload,
  EventKind,
  ExpansionCategory,
  GameAction,
  GameEvent,
  GameState,
  Outcome,
  Pending,
  PendingCheck,
  PendingChoice,
  Phase,
  RollMode,
  RunConfig,
  Seat,
  Slot,
} from './types';
