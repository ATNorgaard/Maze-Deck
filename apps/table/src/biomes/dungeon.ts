import { DEFAULT_TABLES } from '../tables';
import type { Biome } from './types';

/**
 * The deck as printed. Wet stone, three corridors, no map.
 *
 * The dungeon rewords nothing: it is the setting the cards were
 * written for, so its copy IS the canonical copy, and its tables
 * are the default set that shipped with M3.
 */
export const DUNGEON: Biome = {
  id: 'dungeon',
  name: 'Dungeon',
  flavour: 'Wet stone, three corridors, and no map. A Clear Path is a corridor that keeps going.',
  motif: 'fret',
  cards: null,
  tables: DEFAULT_TABLES,
};
