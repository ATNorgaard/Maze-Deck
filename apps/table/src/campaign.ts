/* ============================================================
   Campaign state and its persistence.

   A campaign is the thing a table comes back to: the roster, the
   dials, the setting, and the scenario tables. A run is one
   crossing inside it. See docs/DECISIONS.md P4.
   ============================================================ */

import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC, RIVER_WIDTH, OBSTACLE_JAM } from '@maze-deck/ui';
import type {
  AbilityKey, AbilityScore, ExpansionCategory, GameState, RollMode, RunConfig, Seat,
} from '@maze-deck/rules';
import { biomeOf, DEFAULT_BIOME, isBiomeId } from './biomes';
import type { BiomeId } from './biomes';
import { DEFAULT_TABLES } from './tables';
import type { DrawnPrompt, Tables } from './tables';

export const STORAGE_KEY = 'mazedeck.campaign.v1';
export const SCHEMA_VERSION = 3;

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
  /** Where the maze is. Reskins the cards, the palette and the tables. */
  biome: BiomeId;
  /**
   * Narration tables, one editable set per setting. A setting the
   * GM has never edited has no entry here and reads its biome's
   * defaults — see `tablesFor`. Keyed so switching biome and back
   * never loses what was written for either.
   */
  tablesByBiome: Partial<Record<BiomeId, Tables>>;
  /** The prompt drawn for the card currently in front of the table. */
  prompt: DrawnPrompt | null;
  /** Last entry used per category, so the same one does not repeat. */
  lastPrompt: Partial<Record<string, string>>;
  /** The join code of the room this campaign is hosted in, if any. */
  hostCode: string | null;
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
    biome: DEFAULT_BIOME,
    tablesByBiome: {},
    prompt: null,
    lastPrompt: {},
    hostCode: null,
    run: null,
  };
}

/** A character is a seat, verbatim — the GM verifies, the app does not judge. */
export function toSeat(c: Character): Seat {
  return { id: c.id, name: c.name.trim() || 'Unnamed', cls: c.cls, mods: { ...c.mods } };
}

/**
 * The active setting's tables: the campaign's own copy if it has
 * one, otherwise the biome's defaults. The defaults are a module
 * constant and are never handed out for editing — the first edit
 * goes through `withTables`, which takes the copy.
 */
export function tablesFor(campaign: Campaign): Tables {
  return campaign.tablesByBiome[campaign.biome] ?? biomeOf(campaign.biome).tables;
}

/** Write the active setting's tables back. */
export function withTables(campaign: Campaign, tables: Tables): Campaign {
  return {
    ...campaign,
    tablesByBiome: { ...campaign.tablesByBiome, [campaign.biome]: tables },
  };
}

/**
 * A run's settings without the seed.
 *
 * This is what a client may send: the server generates the seed, so no
 * browser is ever in a position to compute the deck. See view.ts.
 */
export function runSetupFor(campaign: Campaign): Omit<RunConfig, 'seed'> {
  const { seed, ...setup } = runConfigFor(campaign, '');
  void seed;
  return setup;
}

export function runConfigFor(campaign: Campaign, seed: string): RunConfig {
  return {
    seed,
    biome: campaign.biome,
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
    const parsed = JSON.parse(raw) as Legacy;
    const migrated = migrate(parsed);
    if (!migrated) return newCampaign();
    const campaign = { ...newCampaign(), ...migrated } as Campaign;
    // A biome that no longer exists is not worth losing a campaign over.
    if (!isBiomeId(campaign.biome)) campaign.biome = DEFAULT_BIOME;
    return campaign;
  } catch {
    return newCampaign();
  }
}

/** Every shape a stored campaign has ever had, loosely. */
type Legacy = Partial<Campaign> & {
  version?: number;
  /** v2: one table set, before settings existed. */
  tables?: Tables;
};

/**
 * Bring a stored blob up to the current schema, or give up on it.
 *
 * v1 knew nothing about tables, so it gets the defaults and keeps
 * everything else — a campaign in progress is not worth throwing away
 * over a field that did not exist yet.
 *
 * v2 had one table set and no setting. Every v2 campaign was played
 * in the dungeon (there was nowhere else), so its tables become the
 * dungeon's copy and nothing the GM wrote is lost. A run in progress
 * is stamped the same way, since its config predates the field.
 */
function migrate(blob: Legacy): Legacy | null {
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

  if (c.version === 2) {
    const { tables, run, ...rest } = c;
    c = {
      ...rest,
      version: 3,
      biome: DEFAULT_BIOME,
      tablesByBiome: tables ? { [DEFAULT_BIOME]: tables } : {},
      run: run ? { ...run, config: { ...run.config, biome: DEFAULT_BIOME } } : null,
    };
  }

  if (c.version !== SCHEMA_VERSION) return null;

  if (!c.tablesByBiome) c = { ...c, tablesByBiome: {} };
  return c;
}

export function save(campaign: Campaign): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
  } catch {
    /* storage full or blocked — the run stays in memory */
  }
}
