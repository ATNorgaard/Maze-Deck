/* ============================================================
   Scenario tables.

   The rules tell a GM to build a table per category and narrate
   from it. Doing that for them is the main thing this app adds
   over a deck of cards — "invent a compelling scene, twenty-three
   times, on the spot" is the hardest part of running the system,
   and it is exactly the part that stops a newer GM cold.

   Tables belong to the CAMPAIGN, not the run: written once,
   reused every crossing. See docs/DECISIONS.md A5 and P4.

   Each biome ships its own set — the one below is the dungeon's,
   and the rest live in `biomes/`. A campaign keeps a separate,
   editable copy per setting (see `tablesByBiome` in campaign.ts).

   Everything here is our own writing.
   ============================================================ */

import type { AbilityScore, CardCategory } from '@maze-deck/rules';

export interface TableEntry {
  id: string;
  /** What the GM reads, or riffs off. */
  text: string;
  /**
   * Obstacles only: the check this one suggests. The DC is an offset
   * from the campaign's Maze DC rather than a fixed number, so raising
   * the Maze DC still scales the whole system from one dial.
   */
  score?: AbilityScore;
  dcOffset?: number;
}

export type Tables = Record<CardCategory, TableEntry[]>;

/** A prompt drawn for a revealed card, kept until the next one. */
export interface DrawnPrompt {
  category: CardCategory;
  entryId: string;
  text: string;
  score?: AbilityScore;
  dcOffset?: number;
}

/** Build one entry. Exported so each biome's set can use the same shorthand. */
export const entry = (id: string, text: string, score?: AbilityScore, dcOffset?: number): TableEntry =>
  (score === undefined ? { id, text } : { id, text, score, dcOffset: dcOffset ?? 0 });
const e = entry;

export const DEFAULT_TABLES: Tables = {
  'clear-path': [
    e('cp1', 'The passage opens out. Somebody notices the draught is coming from ahead now, not behind.'),
    e('cp2', 'Old bootprints in the dust, going the same way you are. They have not filled in.'),
    e('cp3', 'A stair, cut rather than worn. Whoever built this wanted people to get through.'),
    e('cp4', 'The walls change from packed earth to dressed stone. Somebody maintained this stretch.'),
    e('cp5', 'A shaft of daylight, thin as a blade, from somewhere far overhead. It is the wrong colour for morning.'),
    e('cp6', 'A door already standing open, and beyond it the air smells of rain.'),
  ],

  obstacle: [
    e('ob1', 'A slab has come down across the way. It can be shifted, but not quietly.', 'STR', 0),
    e('ob2', 'The floor gives out into a gap too wide to step. Something has to be spanned or jumped.', 'DEX', 0),
    e('ob3', 'A lock with no keyhole and seven brass rings, each one carved with a different animal.', 'INT', 1),
    e('ob4', 'Cold water, rising slowly, and no telling how deep the next stretch runs.', 'CON', 0),
    e('ob5', 'The corridor branches into six, and all six are identical. Something here is lying.', 'WIS', 1),
    e('ob6', 'A door that will not open for strangers, and knows exactly what a stranger sounds like.', 'CHA', 0),
  ],

  wanderer: [
    e('wa1', 'A miner, three weeks lost, still carrying a full pack and refusing to open it.'),
    e('wa2', 'Something with too many joints, sitting very still, watching the party pass. It does not follow.'),
    e('wa3', 'A child who should not be down here, who answers every question with a question.'),
    e('wa4', 'A surveyor with half a map, willing to trade the half they have for the half they do not.'),
    e('wa5', 'A body, until it speaks. It would like to be carried, and says please.'),
    e('wa6', 'Two of them, arguing, who stop the moment they are seen and agree they were never here.'),
  ],

  item: [
    e('it1', 'A lantern that burns without fuel, and burns a little brighter near danger.'),
    e('it2', 'Somebody else’s journal. The last four pages are torn out; the fifth-from-last names one of you.'),
    e('it3', 'A ring of keys. Most are rusted through. Two are not.'),
    e('it4', 'A coil of rope, good rope, still tied off to something you cannot see the end of.'),
    e('it5', 'A sealed jar of something that moves when nobody is looking at it.'),
    e('it6', 'Coins from a mint that closed two hundred years ago, and not one of them worn.'),
  ],

  monster: [
    e('mo1', 'Something heavy shifts its weight, far off, and stops when you stop.'),
    e('mo2', 'A smell arrives before anything else does — wet fur and old iron.'),
    e('mo3', 'Scratches on the wall at exactly the height of your throat, and they are fresh.'),
  ],

  /* Expansion categories. Not in the standard deck, but a table each
     so nothing is empty if a run opts into them. */
  'dead-end': [
    e('de1', 'The passage simply stops. No rubble, no door — it was never finished.'),
    e('de2', 'A wall of packed earth, and something on the other side of it breathing.'),
  ],

  trap: [
    e('tr1', 'The flagstone sinks a finger’s width, and somewhere above you a counterweight lets go.'),
    e('tr2', 'A tripline, already broken. Whatever it was holding has been waiting a long time.'),
  ],
};

export function emptyTables(): Tables {
  return {
    'clear-path': [], obstacle: [], wanderer: [], item: [],
    monster: [], 'dead-end': [], trap: [],
  };
}

let seq = 0;
export function newEntryId(): string {
  seq += 1;
  return `e${Date.now().toString(36)}${seq}`;
}

/**
 * Draw a prompt for a revealed card.
 *
 * Deliberately not from the engine's seeded generator: this is
 * narration, not game state, and keeping it out of `GameState` means
 * a campaign's tables never have to be serialised into every run.
 * `avoid` is the last entry used for this category, so the same
 * obstacle does not turn up twice running.
 */
export function drawPrompt(
  tables: Tables,
  category: CardCategory,
  avoid?: string,
): DrawnPrompt | null {
  const all = tables[category] ?? [];
  if (all.length === 0) return null;

  const pool = all.length > 1 && avoid
    ? all.filter((entry) => entry.id !== avoid)
    : all;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return null;

  const drawn: DrawnPrompt = { category, entryId: pick.id, text: pick.text };
  if (pick.score !== undefined) drawn.score = pick.score;
  if (pick.dcOffset !== undefined) drawn.dcOffset = pick.dcOffset;
  return drawn;
}
