/* Maze Deck — the engine. */

export {
  IllegalActionError,
  activeSeat,
  apply,
  createGame,
  defaultConfig,
} from './engine';

export { activeSeatOf, availableFor, view } from './view';
export { REVEAL_MS, mayAct, mayAdvanceReveal } from './authority';
export type { Verdict } from './authority';
export {
  CODE_ALPHABET, CODE_LENGTH, isJoinCode, makeJoinCode, normaliseJoinCode,
} from './protocol';
export type {
  ClientMessage, JoinRequest, Presence, RunSetup, SeatOffer, ServerMessage,
} from './protocol';
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
