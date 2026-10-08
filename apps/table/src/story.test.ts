/* The end screen's telling: scenes in order and in their rounds, and
   every encounter on the Monster that caused it, with how it went. */

import { describe, expect, it } from 'vitest';
import type { GameEvent, Seat } from '@maze-deck/rules';
import type { ChronicleEntry } from './campaign';
import { fightsIn, fightsPhrase, recap, tell } from './story';

const seat = (id: string): Seat => ({ id, name: id, cls: '', mods: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } });
const line = (n: number, kind: GameEvent['kind'] = 'sys', cue?: GameEvent['cue']): GameEvent => (
  cue ? { n, kind, visibility: 'all', text: '', cue } : { n, kind, visibility: 'all', text: '' }
);
const scene = (pick: number, slot: number, round: number, category: ChronicleEntry['category'], seatId = 'Wren'): ChronicleEntry => ({
  category, entryId: `e${pick}`, text: `Scene ${pick}.`, key: `${pick}:${slot}`, round, seatId, progress: 0,
});

describe('fightsIn', () => {
  it('reads how each encounter went', () => {
    const log = [
      line(1), line(2, 'bad', 'found'), line(3, 'good'), line(4, 'muted'),
      line(5), line(6, 'bad', 'found'), line(7, 'bad'), line(8, 'muted'),
      line(9, 'bad', 'found'), line(10, 'bad', 'lost'),
    ];
    expect([...fightsIn(log)]).toEqual([[2, 'won'], [6, 'away'], [9, 'lost']]);
  });

  it('leaves an encounter the run closed on unsettled', () => {
    expect([...fightsIn([line(1, 'bad', 'found')])]).toEqual([[1, 'unsettled']]);
  });

  it('says how they went in a clause', () => {
    expect(fightsPhrase([])).toBe('never found');
    expect(fightsPhrase(['won'])).toBe('found once, and won');
    expect(fightsPhrase(['away', 'away'])).toBe('found twice, and got away every time');
    expect(fightsPhrase(['won', 'away'])).toBe('found twice: won once, got away once');
    expect(fightsPhrase(['won', 'lost'])).toBe('found twice, and the last time it ended there');
  });
});

describe('tell', () => {
  const seats = [seat('Wren'), seat('Brakka')];

  it('puts the scenes in order, in their rounds, with who took which path', () => {
    const story = tell(
      [scene(9, 2, 2, 'item', 'Brakka'), scene(3, 0, 1, 'clear-path'), scene(6, 1, 1, 'obstacle', 'Brakka')],
      { log: [], seats },
    );
    expect(story.rounds.map((r) => r.round)).toEqual([1, 2]);
    expect(story.rounds[0]?.scenes.map((s) => [s.entry.key, s.who, s.path])).toEqual([
      ['3:0', 'Wren', 'left'], ['6:1', 'Brakka', 'centre'],
    ]);
    expect(story.rounds[1]?.scenes[0]?.path).toBe('right');
  });

  it('gives each encounter to the Monster that began it', () => {
    const story = tell(
      [scene(3, 0, 1, 'monster'), scene(8, 1, 1, 'monster'), scene(14, 2, 2, 'clear-path')],
      { log: [line(3), line(4, 'bad'), line(8), line(10, 'bad', 'found'), line(11, 'good')], seats },
    );
    const fights = story.rounds.flatMap((r) => r.scenes.map((s) => s.fight));
    expect(fights).toEqual([null, 'won', null]);
    expect(story.fights).toEqual(['won']);
  });

  it('tells it back as text', () => {
    const story = tell(
      [scene(3, 0, 1, 'monster')],
      { log: [line(3), line(5, 'bad', 'found'), line(6, 'bad')], seats },
    );
    const text = recap(story, { runName: 'The Ashen Tower', setting: 'Dungeon', ending: 'The run is closed.' });
    expect(text).toBe([
      'The Ashen Tower — Dungeon',
      'The run is closed.',
      '',
      'Round 1',
      '  Wren, the left path — Monster: Scene 3.',
      '    Found — and they got away.',
    ].join('\n'));
  });
});
