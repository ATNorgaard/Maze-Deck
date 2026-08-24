/* ============================================================
   Balance simulator.

   Plays many seeded runs headlessly and reports how often the
   party gets through. Not part of `npm test` — it is a tool for
   answering "is this deck winnable, and how tense is it".

     npx vite-node scripts/simulate.ts 2000

   The policies below only ever read FACE-UP river cards. A
   policy that peeks at face-down categories reports a game
   nobody is actually playing.
   ============================================================ */

import { apply, available, createGame, defaultConfig } from '../src/engine';
import { int, seedFrom } from '../src/rng';
import type { RngState } from '../src/rng';
import type {
  AbilityKey, AbilityScore, GameAction, GameState, RunConfig, Seat,
} from '../src/types';
import { getCategory } from '../../ui/src/types';

const SCORES: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

function seats(n: number, mod: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    mods: Object.fromEntries(SCORES.map((s) => [s, mod])) as Record<AbilityScore, number>,
  }));
}

interface Table {
  /** How often the party wins the combat the app hands them. */
  encounterWin: number;
  /** Whether losing that combat ends the run. */
  endOnLoss: boolean;
  /** Whether the party ever spends a turn fattening the deck. */
  forge: boolean;
}

type Policy = (g: GameState, rng: RngState) => GameAction | null;

function makePolicy(table: Table, smart: boolean): Policy {
  return (g, rng) => {
    const a = available(g);

    if (g.phase === 'encounter') {
      const won = int(rng, 100) < table.encounterWin * 100;
      return { type: 'RESOLVE_ENCOUNTER', won, endRun: !won && table.endOnLoss };
    }
    if (g.phase === 'check') return { type: 'CONFIRM_CHECK' };
    if (g.phase === 'choice') return resolveChoice(g, rng, smart);
    if (g.phase === 'over') return null;

    const usable = a.abilities.filter((k) => table.forge || k !== 'forge-a-path');

    if (g.phase === 'act') {
      if (!smart) {
        const pick = usable[int(rng, usable.length)];
        return pick ? { type: 'USE_ABILITY', ability: pick } : null;
      }
      if (a.obstacleSlots.length > 0) {
        return { type: 'ATTEMPT_OBSTACLE', slot: a.obstacleSlots[0] as number, score: 'STR' };
      }
      const order: AbilityKey[] = [
        'forge-a-path', 'careful-consideration', 'scout-ahead',
        'its-elementary', 'steel-yourself', 'boost-morale',
      ];
      const choice = order.find((k) => usable.includes(k));
      return choice ? { type: 'USE_ABILITY', ability: choice } : null;
    }

    // Pick phase.
    if (!a.pickSlots.length) return null;
    if (!smart) {
      return { type: 'PICK_SLOT', index: a.pickSlots[int(rng, a.pickSlots.length)] as number };
    }
    const seen = g.river.map((s, i) => ({ s, i })).filter(({ s }) => s.category !== null && s.faceUp);
    const win = seen.find(({ s }) => s.category === 'clear-path');
    if (win) return { type: 'PICK_SLOT', index: win.i };
    const blind = g.river.map((s, i) => ({ s, i })).filter(({ s }) => s.category !== null && !s.faceUp);
    if (blind.length) {
      return { type: 'PICK_SLOT', index: (blind[int(rng, blind.length)] as { i: number }).i };
    }
    return { type: 'PICK_SLOT', index: a.pickSlots[0] as number };
  };
}

function resolveChoice(g: GameState, rng: RngState, smart: boolean): GameAction | null {
  const c = available(g).choice;
  if (!c) return null;
  switch (c.kind) {
    case 'scout-top': {
      const best = smart ? c.cards.findIndex((x) => x === 'clear-path') : -1;
      const idx = best >= 0 ? best : int(rng, c.cards.length);
      return { type: 'RESOLVE_CHOICE', payload: { kind: 'scout-top', cardIndex: idx } };
    }
    case 'swap-river': {
      const best = smart ? c.cards.findIndex((x) => x === 'clear-path') : -1;
      const slots = g.river.flatMap((s, i) => (s.category !== null ? [i] : []));
      const target = smart
        ? g.river.findIndex((s) => s.category !== null && s.faceUp && getCategory(s.category).blocker)
        : -1;
      return {
        type: 'RESOLVE_CHOICE',
        payload: {
          kind: 'swap-river',
          cardIndex: best >= 0 ? best : 0,
          slot: target >= 0 ? target : (slots[int(rng, slots.length)] ?? 0),
        },
      };
    }
    case 'discard-revealed': {
      const ranked = smart
        ? [...c.slots].sort((a, b) => worth(g, b) - worth(g, a))
        : c.slots;
      return { type: 'RESOLVE_CHOICE', payload: { kind: 'discard-revealed', slot: ranked[0] as number } };
    }
    case 'boost-target':
      return { type: 'RESOLVE_CHOICE', payload: { kind: 'boost-target', seatId: g.order[0] as string } };
    case 'wanderer-stays':
      return { type: 'RESOLVE_CHOICE', payload: { kind: 'wanderer-stays', stays: false } };
  }
}

/** How much a table wants that card gone. Higher is worse to keep. */
function worth(g: GameState, slot: number): number {
  const c = g.river[slot]?.category;
  if (!c) return -1;
  if (c === 'monster') return 3;
  if (getCategory(c).blocker) return 2;
  if (c === 'clear-path') return -5;
  return 1;
}

interface Result {
  through: number;
  lost: number;
  stalled: number;
  rounds: number[];
  reserve: number[];
  encounters: number[];
}

function run(table: Table, smart: boolean, runs: number, config: Partial<RunConfig>): Result {
  const policy = makePolicy(table, smart);
  const out: Result = { through: 0, lost: 0, stalled: 0, rounds: [], reserve: [], encounters: [] };

  for (let i = 0; i < runs; i += 1) {
    let g = createGame({ ...defaultConfig(`sim-${i}`, seats(4, 3)), ...config });
    const rng = seedFrom(`policy-${i}`);
    let steps = 0;
    let encounters = 0;
    let wasEncounter = false;

    while (g.phase !== 'over' && steps < 6000) {
      const action = policy(g, rng);
      if (!action) break;
      g = apply(g, action).state;
      if (g.phase === 'encounter' && !wasEncounter) encounters += 1;
      wasEncounter = g.phase === 'encounter';
      steps += 1;
    }

    if (g.phase !== 'over') out.stalled += 1;
    else if (g.outcome === 'through') out.through += 1;
    else out.lost += 1;
    out.rounds.push(g.round);
    out.reserve.push(g.reserveIssued);
    out.encounters.push(encounters);
  }
  return out;
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function report(label: string, r: Result, runs: number): void {
  const pct = (n: number) => `${((n / runs) * 100).toFixed(1)}%`;
  console.log(
    `  ${label.padEnd(26)} through ${pct(r.through).padStart(6)}` +
    `  lost ${pct(r.lost).padStart(6)}` +
    `  rounds ${mean(r.rounds).toFixed(1).padStart(5)}` +
    `  encounters ${mean(r.encounters).toFixed(2).padStart(5)}` +
    `  reserve ${mean(r.reserve).toFixed(1).padStart(5)}`,
  );
}

const runs = Number(process.argv[2] ?? 2000);
const forgiving: Table = { encounterWin: 0.75, endOnLoss: false, forge: true };
const brutal: Table = { encounterWin: 0.5, endOnLoss: true, forge: true };

console.log(`\nMaze Deck — ${runs} runs per row, 4 seats at +3, Maze DC 15`);
console.log('"encounters" is how many times the party was found and handed to the table.\n');

console.log('As written');
report('random play', run(forgiving, false, runs, {}), runs);
report('competent play', run(forgiving, true, runs, {}), runs);

console.log('\nWithout Forge a Path — no deck fattening');
report('competent, no forge', run({ ...forgiving, forge: false }, true, runs, {}), runs);
report('random, no forge', run({ ...forgiving, forge: false }, false, runs, {}), runs);

console.log('\nIf a lost encounter ends the run (coin-flip combat)');
report('competent', run(brutal, true, runs, {}), runs);
report('competent, no forge', run({ ...brutal, forge: false }, true, runs, {}), runs);

console.log('\nDifficulty dials, competent play');
report('target 3', run(forgiving, true, runs, { escapeTarget: 3 }), runs);
report('target 7', run(forgiving, true, runs, { escapeTarget: 7 }), runs);
report('+3 Monsters', run(forgiving, true, runs, { extraMonster: 3 }), runs);
report('Maze DC 18', run(forgiving, true, runs, { mazeDc: 18 }), runs);
report('Maze DC 10', run(forgiving, true, runs, { mazeDc: 10 }), runs);

console.log('');
