/* ============================================================
   Campaign state and its persistence.

   A campaign is the thing a table comes back to: the roster, the
   dials, and the scenario tables once M3 adds them. A run is one
   crossing inside it. See docs/DECISIONS.md P4.
   ============================================================ */

import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC, RIVER_WIDTH, OBSTACLE_JAM } from '@maze-deck/ui';
import type {
  AbilityKey, AbilityScore, ExpansionCategory, GameState, RollMode, RunConfig, Seat,
} from '@maze-deck/rules';
import { DEFAULT_TABLES, emptyTables } from './tables';
import type { DrawnPrompt, Tables } from './tables';

export const STORAGE_KEY = 'mazedeck.campaign.v1';
export const SCHEMA_VERSION = 2;

export const SCORES: AbilityScore[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const ALL_ABILITIES: AbilityKey[] = [
  'forge-a-path', 'scout-ahead', 'steel-yourself',
  'its-elementary', 'careful-consideration', 'boost-morale',
];

export interface Character {
  id: string;
  name: string;
  cls: string;
  mods: Record<AbilityScore, number>;
}

export interface Campaign {
  version: number;
  name: string;
  roster: Character[];
  runName: string;
  mazeDc: number;
  escapeTarget: number;
  rollMode: RollMode;
  extraClearPath: number;
  extraMonster: number;
  expansions: ExpansionCategory[];
  /** Narration tables. Written once, reused every crossing. */
  tables: Tables;
  /** The prompt drawn for the card currently in front of the table. */
  prompt: DrawnPrompt | null;
  /** Last entry used per category, so the same one does not repeat. */
  lastPrompt: Partial<Record<string, string>>;
  /** The crossing in progress, or null between runs. */
  run: GameState | null;
}

let counter = 0;
export function newId(): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${counter}-${rand}`;
}

export function blankCharacter(name = ''): Character {
  return {
    id: newId(),
    name,
    cls: '',
    mods: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
  };
}

export function newCampaign(): Campaign {
  return {
    version: SCHEMA_VERSION,
    name: 'A new campaign',
    roster: [
      { ...blankCharacter('Brakka'), cls: 'Fighter', mods: { STR: 3, DEX: 1, CON: 2, INT: 0, WIS: 1, CHA: 0 } },
      { ...blankCharacter('Wren'), cls: 'Rogue', mods: { STR: 0, DEX: 4, CON: 1, INT: 2, WIS: 1, CHA: 1 } },
      { ...blankCharacter('Odalis'), cls: 'Cleric', mods: { STR: 1, DEX: 0, CON: 2, INT: 1, WIS: 4, CHA: 1 } },
      { ...blankCharacter('Sable'), cls: 'Wizard', mods: { STR: -1, DEX: 1, CON: 1, INT: 4, WIS: 2, CHA: 0 } },
    ],
    runName: 'The Ashen Tower',
    mazeDc: MAZE_DC,
    escapeTarget: ESCAPE_TARGET,
    rollMode: 'app',
    extraClearPath: 0,
    extraMonster: 0,
    expansions: [],
    // Cloned: DEFAULT_TABLES is a module constant and the editor
    // writes straight into the campaign.
    tables: structuredClone(DEFAULT_TABLES),
    prompt: null,
    lastPrompt: {},
    run: null,
  };
}

/** A character is a seat, verbatim — the GM verifies, the app does not judge. */
export function toSeat(c: Character): Seat {
  return { id: c.id, name: c.name.trim() || 'Unnamed', cls: c.cls, mods: { ...c.mods } };
}

export function runConfigFor(campaign: Campaign, seed: string): RunConfig {
  return {
    seed,
    mazeDc: campaign.mazeDc,
    escapeTarget: campaign.escapeTarget,
    riverWidth: RIVER_WIDTH,
    encounterAt: ENCOUNTER_AT,
    obstacleJam: OBSTACLE_JAM,
    rollMode: campaign.rollMode,
    abilities: ALL_ABILITIES,
    expansions: campaign.expansions,
    extraClearPath: campaign.extraClearPath,
    extraMonster: campaign.extraMonster,
    seats: campaign.roster.map(toSeat),
  };
}

/* ---------------- persistence ---------------- */

export function load(): Campaign {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return newCampaign();
    const parsed = JSON.parse(raw) as Partial<Campaign> & { version?: number };
    const migrated = migrate(parsed);
    if (!migrated) return newCampaign();
    return { ...newCampaign(), ...migrated } as Campaign;
  } catch {
    return newCampaign();
  }
}

/**
 * Bring a stored blob up to the current schema, or give up on it.
 *
 * v1 knew nothing about tables, so it gets the defaults and keeps
 * everything else — a campaign in progress is not worth throwing away
 * over a field that did not exist yet.
 */
function migrate(
  blob: Partial<Campaign> & { version?: number },
): Partial<Campaign> | null {
  let c = blob;

  if (c.version === 1) {
    c = {
      ...c,
      version: 2,
      tables: structuredClone(DEFAULT_TABLES),
      prompt: null,
      lastPrompt: {},
    };
  }

  if (c.version !== SCHEMA_VERSION) return null;

  // A campaign saved with an emptied table set is still valid; only a
  // missing one is a problem.
  if (!c.tables) c = { ...c, tables: emptyTables() };
  return c;
}

export function save(campaign: Campaign): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
  } catch {
    /* storage full or blocked — the run stays in memory */
  }
}
