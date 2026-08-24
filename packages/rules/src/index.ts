/* Maze Deck — the engine. */

export {
  IllegalActionError,
  activeSeat,
  apply,
  createGame,
  defaultConfig,
} from './engine';

export { activeSeatOf, availableFor, view } from './view';
export type {
  Available, GameView, Viewer, ViewRules, ViewSlot,
} from './view';
export type { ApplyResult } from './engine';

export { d, int, next, seedFrom, shuffle } from './rng';
export type { RngState } from './rng';

export type {
  AbilityKey,
  AbilityScore,
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
  Revealed,
  RollMode,
  RunConfig,
  Seat,
  Slot,
} from './types';
