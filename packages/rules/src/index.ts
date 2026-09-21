/* Maze Deck — the engine. */

export {
  IllegalActionError,
  activeSeat,
  apply,
  createGame,
  defaultConfig,
} from './engine.js';

export { activeSeatOf, availableFor, view } from './view.js';
export { REVEAL_MS, mayAct, mayAdvanceReveal } from './authority.js';
export type { Verdict } from './authority.js';
export {
  CODE_ALPHABET, CODE_LENGTH, isJoinCode, makeJoinCode, normaliseJoinCode,
} from './protocol.js';
export type {
  JoinRequest, Presence, RunSetup, SeatOffer,
} from './protocol.js';
export type {
  Available, GameView, Viewer, ViewRules, ViewSlot,
} from './view.js';
export type { ApplyResult } from './engine.js';

export { d, int, next, seedFrom, shuffle } from './rng.js';
export type { RngState } from './rng.js';

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
} from './types.js';
