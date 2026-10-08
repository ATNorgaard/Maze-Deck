/* The cues on the log (DECISIONS O2): one line per moment a board
   plays, marked with what it was, so a screen plays what happened
   instead of inferring it from counts. One test per cue, plus the two
   properties that keep them honest: they are public, and nothing that
   is not one of those moments carries one. */

import { describe, expect, it } from 'vitest';
import { apply } from '../src/engine.js';
import { view } from '../src/view.js';
import { makeRun, playOut } from './harness.js';
import type { CardCategory, Cue, GameEvent, GameState } from '../src/types.js';

function atPick(seed: string, cards: (CardCategory | null)[], patch: Partial<GameState> = {}): GameState {
  const g = structuredClone(makeRun(seed));
  g.river = cards.map((c) => ({ category: c, faceUp: false }));
  g.phase = 'pick';
  return Object.assign(g, patch);
}

/** Commit to a path and let the reveal advance, keeping every event. */
function pick(g: GameState, index: number): { state: GameState; events: GameEvent[] } {
  const a = apply(g, { type: 'PICK_SLOT', index });
  const b = apply(a.state, { type: 'ADVANCE_REVEAL' });
  return { state: b.state, events: [...a.events, ...b.events] };
}

const cues = (events: GameEvent[]): Cue[] => events.flatMap((e) => (e.cue ? [e.cue] : []));

describe('cues', () => {
  it('marks a jam', () => {
    const g = atPick('cue-jam', ['obstacle', 'obstacle', 'obstacle']);
    g.river[0] = { category: 'obstacle', faceUp: true };
    g.river[1] = { category: 'obstacle', faceUp: true };
    const { events } = pick(g, 2);
    expect(cues(events)).toEqual(['jam']);
    expect(events.find((e) => e.cue === 'jam')?.kind).toBe('bad');
  });

  it('marks the discard going back into the deck', () => {
    const g = atPick('cue-reshuffle', ['item', 'item', 'item'], {
      deck: [], discard: ['clear-path', 'monster', 'item'],
    });
    const { state, events } = pick(g, 0);
    expect(cues(events)).toEqual(['reshuffle']);
    expect(state.discard).toHaveLength(0);
  });

  it('marks the party being found', () => {
    const g = atPick('cue-found', ['monster', 'item', 'item'], { strikes: 1 });
    const { state, events } = pick(g, 0);
    expect(state.phase).toBe('encounter');
    expect(cues(events)).toEqual(['found']);
  });

  it('marks the party through, however the run closes', () => {
    const g = atPick('cue-through', ['clear-path', 'item', 'item'], { progress: 4 });
    expect(cues(pick(g, 0).events)).toEqual(['through']);

    const closed = apply(Object.assign(makeRun('cue-through-closed'), { progress: 5 }), { type: 'END_RUN' });
    expect(cues(closed.events)).toEqual(['through']);
  });

  it('marks the party lost, however the run closes', () => {
    const g = atPick('cue-lost', ['monster', 'item', 'item'], { strikes: 1 });
    const fought = pick(g, 0).state;
    const kept = apply(fought, { type: 'RESOLVE_ENCOUNTER', won: false, endRun: true });
    expect(cues(kept.events)).toEqual(['lost']);

    const closed = apply(makeRun('cue-lost-closed'), { type: 'END_RUN' });
    expect(cues(closed.events)).toEqual(['lost']);

    // Nothing left anywhere: the last card is a Trap, which leaves the
    // game rather than the river, and the run goes with it.
    const dry = atPick('cue-lost-dry', ['trap', null, null], { deck: [], discard: [] });
    const out = pick(dry, 0);
    expect(out.state.outcome).toBe('lost');
    expect(cues(out.events)).toEqual(['lost']);
  });

  it('reaches every client, because every cued line is public', () => {
    const { final } = playOut(makeRun('cue-public'), 'cue-public');
    const marked = final.log.filter((e) => e.cue);
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.every((e) => e.visibility === 'all')).toBe(true);

    const seat = final.order[0] as string;
    const seen = view(final, { role: 'player', seatId: seat }).log.filter((e) => e.cue);
    expect(seen).toEqual(marked);
  });

  it('marks nothing else', () => {
    const { states } = playOut(makeRun('cue-quiet'), 'cue-quiet');
    const final = states[states.length - 1] as GameState;
    const allowed = new Map<Cue, RegExp>([
      ['jam', /blocked at once/],
      ['reshuffle', /shuffled back into the deck/],
      ['found', /The party is found/],
      ['through', /The party is through|closes the run/],
      ['lost', /keeps them|nothing left to draw|closes the run/],
    ]);
    for (const e of final.log) {
      if (e.cue) expect(e.text).toMatch(allowed.get(e.cue) as RegExp);
      else expect(e.text).not.toMatch(/blocked at once|shuffled back into the deck|The party is found|The party is through/);
    }
  });
});
