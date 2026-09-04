/* ============================================================
   The Maze Deck engine.

   Pure: no DOM, no storage, no clock, no Math.random. Every
   transition is `apply(state, action) -> { state, events }` and
   every random draw comes from the seeded generator held inside
   the state, so a run replays exactly from its seed.

   Rules: docs/reference/canonical-rules.md. Where that document
   lists an open question, the resolution is commented at the
   point it is decided.
   ============================================================ */

import {
  CANONICAL_CATEGORIES, ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC,
  OBSTACLE_JAM, RIVER_WIDTH, getAbility, getCategory,
} from '../../ui/src/types';
import type { AbilityKey, AbilityScore, CardCategory } from '../../ui/src/types';
import { d, seedFrom, shuffle } from './rng';
import type {
  Choice, ChoicePayload, GameAction, GameEvent, GameState,
  PendingCheck, RunConfig, Seat, Slot,
} from './types';

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

const POSITION = ['left', 'centre', 'right'];

function positionName(i: number): string {
  return POSITION[i] ?? `slot ${i + 1}`;
}

/* ---------------------------------------------------------------
   Config
   --------------------------------------------------------------- */

export function defaultConfig(seed: string, seats: Seat[]): RunConfig {
  return {
    seed,
    biome: 'dungeon',
    mazeDc: MAZE_DC,
    escapeTarget: ESCAPE_TARGET,
    riverWidth: RIVER_WIDTH,
    encounterAt: ENCOUNTER_AT,
    obstacleJam: OBSTACLE_JAM,
    rollMode: 'app',
    abilities: ['forge-a-path', 'scout-ahead', 'steel-yourself',
      'its-elementary', 'careful-consideration', 'boost-morale'],
    expansions: [],
    extraClearPath: 0,
    extraMonster: 0,
    seats,
  };
}

/* ---------------------------------------------------------------
   Small typed accessors. `noUncheckedIndexedAccess` is on, and
   these keep the rules readable without scattering assertions.
   --------------------------------------------------------------- */

function slotAt(g: GameState, i: number): Slot {
  const s = g.river[i];
  if (!s) throw new IllegalActionError(`No river slot ${i}`);
  return s;
}

function seatById(g: GameState, id: string): Seat {
  const s = g.config.seats.find((x) => x.id === id);
  if (!s) throw new IllegalActionError(`No seat ${id}`);
  return s;
}

/** Whose turn it is. */
export function activeSeat(g: GameState): Seat {
  const id = g.order[g.turn % g.order.length];
  if (!id) throw new IllegalActionError('No seats in the run');
  return seatById(g, id);
}

/* ---------------------------------------------------------------
   Deck
   --------------------------------------------------------------- */

function buildDeck(config: RunConfig): CardCategory[] {
  const cards: CardCategory[] = [];
  for (const def of CANONICAL_CATEGORIES) {
    for (let i = 0; i < def.copies; i += 1) cards.push(def.category);
  }
  for (const key of config.expansions) {
    const def = getCategory(key);
    for (let i = 0; i < def.copies; i += 1) cards.push(def.category);
  }
  for (let i = 0; i < config.extraClearPath; i += 1) cards.push('clear-path');
  for (let i = 0; i < config.extraMonster; i += 1) cards.push('monster');
  return cards;
}

/**
 * Take the top card. Reshuffles the discard back in when the deck
 * runs dry; returns null only when there is genuinely no card
 * anywhere. Removed cards never come back.
 */
function draw(g: GameState, events: GameEvent[]): CardCategory | null {
  if (g.deck.length === 0 && g.discard.length > 0) {
    g.deck = shuffle(g.rng, g.discard.slice());
    g.discard = [];
    push(g, events, 'muted', 'all', 'The discard is shuffled back into the deck.');
  }
  return g.deck.pop() ?? null;
}

/** Fill every empty slot. A river below full width is always a bug. */
function refill(g: GameState, events: GameEvent[]): void {
  for (let i = 0; i < g.config.riverWidth; i += 1) {
    const slot = g.river[i];
    if (slot && slot.category !== null) continue;
    const card = draw(g, events);
    g.river[i] = card === null
      ? { category: null, faceUp: false }
      : { category: card, faceUp: false };
  }
}

/* ---------------------------------------------------------------
   Log
   --------------------------------------------------------------- */

function push(
  g: GameState,
  events: GameEvent[],
  kind: GameEvent['kind'],
  visibility: GameEvent['visibility'],
  text: string,
): void {
  const e: GameEvent = { n: g.log.length + 1, kind, visibility, text };
  g.log.push(e);
  events.push(e);
}

/* ---------------------------------------------------------------
   Setup
   --------------------------------------------------------------- */

export function createGame(config: RunConfig): GameState {
  if (config.seats.length === 0) {
    throw new IllegalActionError('A run needs at least one seat');
  }

  const rng = seedFrom(config.seed);
  const g: GameState = {
    config,
    rng,
    deck: shuffle(rng, buildDeck(config)),
    river: [],
    discard: [],
    removed: [],
    reserveIssued: 0,
    // R7: initiative is rolled once at the start, then held.
    order: shuffle(rng, config.seats.map((s) => s.id)),
    turn: 0,
    round: 1,
    progress: 0,
    strikes: 0,
    advantage: [],
    phase: 'act',
    pending: null,
    revealed: null,
    outcome: null,
    log: [],
  };

  const events: GameEvent[] = [];
  for (let i = 0; i < config.riverWidth; i += 1) {
    g.river.push({ category: null, faceUp: false });
  }
  refill(g, events);

  push(g, events, 'sys', 'all',
    `The deck is shuffled. ${config.riverWidth} paths lie ahead, face down.`);
  push(g, events, 'muted', 'all',
    `Initiative: ${g.order.map((id) => seatById(g, id).name).join(', ')}.`);

  return g;
}

/* ---------------------------------------------------------------
   Checks
   --------------------------------------------------------------- */

function rollCheck(g: GameState, check: PendingCheck): void {
  if (g.config.rollMode !== 'app') return;
  const first = d(g.rng, 20);
  const second = check.d20b === null ? null : d(g.rng, 20);
  check.d20 = first;
  check.d20b = second;
  check.success = total(check) >= check.dc;
}

function total(check: PendingCheck): number {
  const a = check.d20 ?? 0;
  const b = check.d20b;
  const die = b === null ? a : Math.max(a, b);
  return die + check.mod;
}

function beginCheck(
  g: GameState,
  events: GameEvent[],
  reason: PendingCheck['reason'],
  score: AbilityScore,
  dc: number,
  label: string,
): void {
  const seat = activeSeat(g);
  const hasAdvantage = g.advantage.includes(seat.id);
  if (hasAdvantage) g.advantage = g.advantage.filter((id) => id !== seat.id);

  const check: PendingCheck = {
    kind: 'check',
    seatId: seat.id,
    reason,
    score,
    dc,
    mod: seat.mods[score] ?? 0,
    d20: null,
    // A non-null placeholder is what marks the check as rolled with advantage.
    d20b: hasAdvantage ? 0 : null,
    success: null,
    overridden: false,
  };
  rollCheck(g, check);

  g.pending = check;
  g.phase = 'check';
  push(g, events, 'sys', 'all',
    `${seat.name}: ${label} — ${score} check against DC ${dc}` +
    `${hasAdvantage ? ', with advantage' : ''}.`);
}

/* ---------------------------------------------------------------
   Ability effects. Returns a Choice when the action cannot finish
   without a decision.
   --------------------------------------------------------------- */

function applyAbility(
  g: GameState,
  events: GameEvent[],
  ability: AbilityKey,
): Choice | null {
  switch (ability) {
    case 'forge-a-path': {
      // Reserve cards come from outside the deck; counted so the
      // conservation invariant still balances.
      g.discard.push('clear-path', 'clear-path');
      g.reserveIssued += 2;
      push(g, events, 'good', 'all',
        'Two Clear Paths are worked into the discard pile.');
      return null;
    }

    case 'steel-yourself': {
      const swept = g.river.filter((s) => s.category !== null).length;
      for (const slot of g.river) {
        if (slot.category !== null) g.discard.push(slot.category);
        slot.category = null;
        slot.faceUp = false;
      }
      refill(g, events);
      push(g, events, 'good', 'all',
        `The party pushes through. ${swept} paths swept aside and ${swept} fresh ones dealt.`);
      return null;
    }

    case 'scout-ahead': {
      const cards: CardCategory[] = [];
      for (let i = 0; i < 3; i += 1) {
        const c = draw(g, events);
        if (c === null) break;
        cards.push(c);
      }
      if (cards.length === 0) {
        push(g, events, 'muted', 'all', 'Nothing left to scout.');
        return null;
      }
      push(g, events, 'sys', 'all',
        `${cards.length} cards scouted off the deck.`);
      return { kind: 'scout-top', cards };
    }

    case 'its-elementary': {
      const cards: CardCategory[] = [];
      for (let i = 0; i < 2; i += 1) {
        const c = draw(g, events);
        if (c === null) break;
        cards.push(c);
      }
      if (cards.length === 0) {
        push(g, events, 'muted', 'all', 'The deck is spent. Nothing to deduce.');
        return null;
      }
      return { kind: 'swap-river', cards };
    }

    case 'careful-consideration': {
      const revealed: number[] = [];
      for (let i = 0; i < g.river.length && revealed.length < 2; i += 1) {
        const slot = slotAt(g, i);
        if (slot.category !== null && !slot.faceUp) {
          slot.faceUp = true;
          revealed.push(i);
        }
      }
      if (revealed.length === 0) {
        push(g, events, 'muted', 'all', 'Nothing left face down to consider.');
        return null;
      }
      // A card turned face up is face up on the table. Everyone sees
      // it. Only what is looked at inside the DECK stays private.
      for (const i of revealed) {
        push(g, events, 'card', 'all',
          `Revealed: the ${positionName(i)} path is ${getCategory(slotAt(g, i).category as CardCategory).title}.`);
      }
      return { kind: 'discard-revealed', slots: revealed };
    }

    case 'boost-morale':
      return { kind: 'boost-target' };

    default:
      return null;
  }
}

/* ---------------------------------------------------------------
   Choices
   --------------------------------------------------------------- */

function applyChoice(
  g: GameState,
  events: GameEvent[],
  choice: Choice,
  payload: ChoicePayload,
): void {
  if (choice.kind !== payload.kind) {
    throw new IllegalActionError(
      `Expected a ${choice.kind} decision, got ${payload.kind}`);
  }

  switch (choice.kind) {
    case 'scout-top': {
      const payloadT = payload as Extract<ChoicePayload, { kind: 'scout-top' }>;
      const chosen = choice.cards[payloadT.cardIndex];
      if (chosen === undefined) throw new IllegalActionError('No such scouted card');
      const rest = choice.cards.filter((_, i) => i !== payloadT.cardIndex);
      g.deck.push(...rest);
      shuffle(g.rng, g.deck);
      g.deck.push(chosen);
      // The table talks. One player looking at three cards and keeping
      // it to themselves is theatre, so the peek is public.
      push(g, events, 'card', 'all',
        `${getCategory(chosen).title} goes on top of the deck; the rest are shuffled back in.`);
      return;
    }

    case 'swap-river': {
      const payloadT = payload as Extract<ChoicePayload, { kind: 'swap-river' }>;
      const chosen = choice.cards[payloadT.cardIndex];
      if (chosen === undefined) throw new IllegalActionError('No such drawn card');
      const slot = slotAt(g, payloadT.slot);
      // Open rule: the source does not say where the displaced card
      // goes. We discard it — "replace" reads as taking it out of play,
      // and sending it back to the deck would make the action a no-op
      // in expectation.
      if (slot.category !== null) {
        g.discard.push(slot.category);
        push(g, events, 'card', 'all',
          `${getCategory(slot.category).title} is pulled out of the ${positionName(payloadT.slot)} slot.`);
      }
      slot.category = chosen;
      slot.faceUp = false;
      const rest = choice.cards.filter((_, i) => i !== payloadT.cardIndex);
      g.deck.push(...rest);
      push(g, events, 'sys', 'all',
        `The ${positionName(payloadT.slot)} path is swapped for something chosen.`);
      return;
    }

    case 'discard-revealed': {
      const payloadT = payload as Extract<ChoicePayload, { kind: 'discard-revealed' }>;
      if (!choice.slots.includes(payloadT.slot)) {
        throw new IllegalActionError('That slot was not one of the revealed pair');
      }
      const slot = slotAt(g, payloadT.slot);
      if (slot.category !== null) {
        g.discard.push(slot.category);
        push(g, events, 'card', 'all',
          `${getCategory(slot.category).title} is discarded from the ${positionName(payloadT.slot)} slot.`);
      }
      slot.category = null;
      slot.faceUp = false;

      // "Shuffle what remains and lay it face down again." An Obstacle
      // stays face up wherever it lands: the party has already seen it
      // and it is not resolved.
      const remaining = g.river
        .filter((s) => s.category !== null)
        .map((s) => s.category as CardCategory);
      shuffle(g.rng, remaining);
      let r = 0;
      for (let i = 0; i < g.river.length; i += 1) {
        const s = slotAt(g, i);
        if (s.category === null) continue;
        const card = remaining[r] as CardCategory;
        r += 1;
        s.category = card;
        s.faceUp = getCategory(card).blocker;
      }
      refill(g, events);
      push(g, events, 'good', 'all',
        'One path is struck from the river; the rest are turned back down.');
      return;
    }

    case 'boost-target': {
      const payloadT = payload as Extract<ChoicePayload, { kind: 'boost-target' }>;
      const target = seatById(g, payloadT.seatId);
      if (!g.advantage.includes(target.id)) g.advantage.push(target.id);
      push(g, events, 'good', 'all',
        `${target.name} has advantage on their next check or save.`);
      return;
    }

    case 'wanderer-stays': {
      const payloadT = payload as Extract<ChoicePayload, { kind: 'wanderer-stays' }>;
      const slot = slotAt(g, choice.slot);
      if (payloadT.stays) {
        slot.faceUp = true;
        push(g, events, 'sys', 'all',
          `The wanderer keeps pace with the party, in the ${positionName(choice.slot)}.`);
      } else {
        if (slot.category !== null) g.discard.push(slot.category);
        slot.category = null;
        slot.faceUp = false;
        push(g, events, 'sys', 'all', 'The wanderer goes their own way.');
      }
      return;
    }
  }
}

/* ---------------------------------------------------------------
   Turn resolution
   --------------------------------------------------------------- */

function endTurn(g: GameState): void {
  g.pending = null;
  const wrapped = (g.turn + 1) % g.order.length === 0;
  g.turn = (g.turn + 1) % g.order.length;
  if (wrapped) g.round += 1;
  g.phase = 'act';
}

/** Everything that happens once a picked card has been resolved. */
function afterPick(g: GameState, events: GameEvent[]): void {
  refill(g, events);

  // Three Obstacles at once: the river is cleared and the noise
  // brings something in. The extra Monster enters the DISCARD, so
  // it arrives a cycle later rather than immediately.
  const jammed = g.river.filter(
    (s) => s.category !== null && getCategory(s.category).blocker,
  ).length;
  if (jammed >= g.config.obstacleJam) {
    for (const slot of g.river) {
      if (slot.category !== null) g.discard.push(slot.category);
      slot.category = null;
      slot.faceUp = false;
    }
    g.discard.push('monster');
    g.reserveIssued += 1;
    refill(g, events);
    push(g, events, 'bad', 'all',
      `${jammed} paths blocked at once. The party doubles back — and something takes notice.`);
  }

  if (g.progress >= g.config.escapeTarget) {
    g.outcome = 'through';
    g.phase = 'over';
    g.pending = null;
    push(g, events, 'good', 'all',
      `${g.progress} Clear Paths. The party is through, in ${g.round} rounds.`);
    return;
  }

  if (g.strikes >= g.config.encounterAt) {
    g.phase = 'encounter';
    g.pending = null;
    push(g, events, 'bad', 'all',
      'The party is found. Roll initiative — this one is yours to run.');
    return;
  }

  // Deck, discard and river all empty. Unreachable with a standard
  // deck, but a river silently running below full width is exactly
  // how the prototype used to wedge, so it ends the run instead.
  if (g.river.every((s) => s.category === null)) {
    g.outcome = 'lost';
    g.phase = 'over';
    g.pending = null;
    push(g, events, 'bad', 'all',
      'There is nothing left to draw. The maze has run out of ways on.');
    return;
  }

  endTurn(g);
}

/**
 * A player commits to a path. The card turns face up in front of the
 * whole table and NOTHING else happens yet — the reveal is its own
 * phase so every screen gets a beat to show what was drawn.
 */
function revealPick(g: GameState, events: GameEvent[], index: number): void {
  const slot = slotAt(g, index);
  const category = slot.category;
  if (category === null) throw new IllegalActionError('That slot is empty');

  slot.faceUp = true;
  g.revealed = {
    slot: index,
    category,
    // Blockers stay put. A Wanderer's fate is undecided until the GM
    // says whether they linger, so it must not be shown leaving yet.
    // Everything else is on its way to the discard.
    leavesRiver: category !== 'wanderer' && !getCategory(category).blocker,
  };
  g.phase = 'reveal';

  push(g, events, 'card', 'all',
    `${activeSeat(g).name} takes the ${positionName(index)} path — ${getCategory(category).title}.`);
}

function resolveRevealed(g: GameState, events: GameEvent[]): void {
  const revealed = g.revealed;
  if (!revealed) throw new IllegalActionError('No card is being revealed');
  const index = revealed.slot;
  const category = revealed.category;
  g.revealed = null;

  const slot = slotAt(g, index);
  const seat = activeSeat(g);

  switch (category) {
    case 'clear-path':
      g.progress += 1;
      g.discard.push(category);
      slot.category = null;
      slot.faceUp = false;
      push(g, events, 'good', 'all',
        `Ground gained — ${g.progress} of ${g.config.escapeTarget}.`);
      break;

    case 'monster':
      g.strikes += 1;
      g.discard.push(category);
      slot.category = null;
      slot.faceUp = false;
      push(g, events, 'bad', 'all',
        `Something out there knows where they are. Strike ${g.strikes} of ${g.config.encounterAt}.`);
      break;

    case 'item':
      g.discard.push(category);
      slot.category = null;
      slot.faceUp = false;
      push(g, events, 'sys', 'all', 'Something worth picking up, or not.');
      break;

    case 'wanderer':
      // The card stays put until the GM says whether they linger.
      slot.faceUp = true;
      g.pending = { kind: 'choice', seatId: seat.id, choice: { kind: 'wanderer-stays', slot: index } };
      g.phase = 'choice';
      push(g, events, 'sys', 'all', 'Somebody else is down here.');
      return;

    case 'obstacle':
    case 'dead-end':
      slot.faceUp = true;
      push(g, events, 'bad', 'all',
        `The way is blocked, and stays blocked until someone deals with it.`);
      break;

    case 'trap':
      // Expansion card. It leaves the game either way; the save
      // itself is the GM's to call at the table.
      g.removed.push(category);
      slot.category = null;
      slot.faceUp = false;
      push(g, events, 'bad', 'all', 'It triggers at once. Call for a save.');
      break;
  }

  afterPick(g, events);
}

/* ---------------------------------------------------------------
   apply
   --------------------------------------------------------------- */

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

export function apply(state: GameState, action: GameAction): ApplyResult {
  const g: GameState = structuredClone(state);
  const events: GameEvent[] = [];

  if (g.phase === 'over' && action.type !== 'END_RUN') {
    throw new IllegalActionError('The run is over');
  }

  switch (action.type) {
    case 'USE_ABILITY': {
      if (g.phase !== 'act') throw new IllegalActionError('Not the action phase');
      if (!g.config.abilities.includes(action.ability)) {
        throw new IllegalActionError(`${action.ability} is not in play this run`);
      }
      const def = getAbility(action.ability);
      beginCheck(g, events,
        { type: 'ability', ability: action.ability },
        def.score, g.config.mazeDc, def.title);
      break;
    }

    case 'ATTEMPT_OBSTACLE': {
      if (g.phase !== 'act') throw new IllegalActionError('Not the action phase');
      const slot = slotAt(g, action.slot);
      if (slot.category === null || !getCategory(slot.category).blocker) {
        throw new IllegalActionError('Nothing blocking that slot');
      }
      // R6: the scenario entry suggests a DC, the GM may overrule it.
      beginCheck(g, events,
        { type: 'obstacle', slot: action.slot },
        action.score, action.dc ?? g.config.mazeDc,
        `clearing the ${positionName(action.slot)} path`);
      break;
    }

    case 'ENTER_ROLL': {
      const p = g.pending;
      if (g.phase !== 'check' || !p || p.kind !== 'check') {
        throw new IllegalActionError('No check is waiting for a roll');
      }
      if (action.d20 < 1 || action.d20 > 20) {
        throw new IllegalActionError('A d20 result is 1 to 20');
      }
      p.d20 = action.d20;
      if (p.d20b !== null) p.d20b = action.d20b ?? action.d20;
      p.success = total(p) >= p.dc;
      push(g, events, 'sys', 'all', `Rolled ${total(p)} against DC ${p.dc}.`);
      break;
    }

    case 'CONFIRM_CHECK': {
      const p = g.pending;
      if (g.phase !== 'check' || !p || p.kind !== 'check') {
        throw new IllegalActionError('No check is waiting');
      }
      if (p.success === null && action.success === undefined) {
        throw new IllegalActionError('The die has not been rolled yet');
      }
      const rolled = p.success;
      const final = action.success ?? (rolled as boolean);
      if (rolled !== null && final !== rolled) p.overridden = true;

      const note = p.overridden ? ' (the GM rules otherwise)' : '';
      push(g, events, final ? 'good' : 'bad', 'all',
        `${seatById(g, p.seatId).name} ${final ? 'succeeds' : 'fails'}${note}.`);

      g.pending = null;
      let choice: Choice | null = null;

      if (final) {
        if (p.reason.type === 'ability') {
          choice = applyAbility(g, events, p.reason.ability);
        } else {
          const slot = slotAt(g, p.reason.slot);
          if (slot.category !== null) {
            g.discard.push(slot.category);
            slot.category = null;
            slot.faceUp = false;
            refill(g, events);
            push(g, events, 'good', 'all',
              `The ${positionName(p.reason.slot)} path is opened up.`);
          }
        }
      }

      if (choice) {
        g.pending = { kind: 'choice', seatId: p.seatId, choice };
        g.phase = 'choice';
      } else {
        g.phase = 'pick';
      }
      break;
    }

    case 'RESOLVE_CHOICE': {
      const p = g.pending;
      if (g.phase !== 'choice' || !p || p.kind !== 'choice') {
        throw new IllegalActionError('No decision is waiting');
      }
      const wasPostPick = p.choice.kind === 'wanderer-stays';
      applyChoice(g, events, p.choice, action.payload);
      g.pending = null;
      if (wasPostPick) afterPick(g, events);
      else g.phase = 'pick';
      break;
    }

    case 'PICK_SLOT': {
      if (g.phase !== 'pick') {
        throw new IllegalActionError('Take an action before choosing a path');
      }
      revealPick(g, events, action.index);
      break;
    }

    case 'ADVANCE_REVEAL': {
      if (g.phase !== 'reveal') throw new IllegalActionError('No card is being revealed');
      resolveRevealed(g, events);
      break;
    }

    case 'RESOLVE_ENCOUNTER': {
      if (g.phase !== 'encounter') throw new IllegalActionError('No encounter is running');
      if (action.won) {
        // Winning thins the deck for good — the source's one piece
        // of lasting relief.
        const fromDeck = g.deck.lastIndexOf('monster');
        if (fromDeck >= 0) g.deck.splice(fromDeck, 1);
        else {
          const fromDiscard = g.discard.lastIndexOf('monster');
          if (fromDiscard >= 0) g.discard.splice(fromDiscard, 1);
        }
        g.removed.push('monster');
        push(g, events, 'good', 'all',
          'The threat is put down, and one Monster leaves the deck for good.');
      } else if (action.endRun) {
        g.outcome = 'lost';
        g.phase = 'over';
        push(g, events, 'bad', 'all', 'The maze keeps them.');
        break;
      } else {
        push(g, events, 'bad', 'all', 'They get away, and keep moving.');
      }
      // Open rule: the source does not say what happens to strikes.
      // They reset, or the very next Monster re-triggers instantly.
      g.strikes = 0;
      // The source calls for initiative to be reset after a threat.
      g.order = shuffle(g.rng, g.order.slice());
      g.turn = 0;
      push(g, events, 'muted', 'all',
        `Initiative: ${g.order.map((id) => seatById(g, id).name).join(', ')}.`);
      g.phase = 'act';
      g.pending = null;
      break;
    }

    case 'END_RUN': {
      if (g.phase === 'over') break;
      g.outcome = g.progress >= g.config.escapeTarget ? 'through' : 'lost';
      g.phase = 'over';
      g.pending = null;
      push(g, events, 'muted', 'all', 'The GM closes the run.');
      break;
    }
  }

  return { state: g, events };
}

/* Views, redaction and `availableFor` live in view.ts — a client is
   never handed GameState, so "what may I do" is derived from the
   view, not from the authoritative state. */
