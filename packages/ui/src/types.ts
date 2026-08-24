/* ============================================================
   MAZE DECK — shared types and the deck definition.
   The composition lives here and nowhere else; every component
   and every count reads from it.
   ============================================================ */

/** The seven deck categories. */
export type CardCategory =
  | 'clear-path'
  | 'dead-end'
  | 'obstacle'
  | 'trap'
  | 'monster'
  | 'wanderer'
  | 'item';

/** The five ability-keyed actions. */
export type AbilityKey =
  | 'forge-a-path'
  | 'scout-ahead'
  | 'its-elementary'
  | 'careful-consideration'
  | 'boost-morale';

/** Every state the arch can be drawn in, plus the neutral seal. */
export type ArchState = CardCategory | AbilityKey | 'seal';

/** D&D ability score a check is made against. */
export type AbilityScore = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/** Scale step. Each re-scales the whole system's base unit. */
export type CardSize = 'sm' | 'md' | 'lg';

/** Static definition of one deck category. */
export interface CategoryDef {
  category: CardCategory;
  /** Display name as printed on the card. */
  title: string;
  /** Small letterspaced kicker above the title. */
  eyebrow: string;
  /** One-line mechanic. `emphasis` marks the phrase the card highlights. */
  rule: string;
  emphasis: string;
  /** Copies of this card in a standard 28-card deck. */
  copies: number;
  /** Redundant, colour-independent corner mark. */
  shapeCode: 'circle' | 'square' | 'bar-h' | 'triangle' | 'eyes' | 'bar-v' | 'cross';
  /** True for the three cards that stop the party. */
  blocker: boolean;
}

/** Static definition of one ability card. */
export interface AbilityDef {
  ability: AbilityKey;
  title: string;
  /** Ability score the check is made against. */
  score: AbilityScore;
  /** Full name of the score, printed as the card's eyebrow. */
  scoreName: string;
  /** What the action does, mechanically. */
  effect: string;
  /** Why a player would spend their turn on it. */
  why: string;
}

/** Default difficulty. Raise it and the whole maze scales. */
export const MAZE_DC = 13;

/** The river is always this many cards wide. */
export const RIVER_WIDTH = 3;

/** Clear Paths needed to escape. */
export const ESCAPE_TARGET = 5;

/** Monsters revealed before a confrontation is forced. */
export const CONFRONTATION_AT = 2;

/**
 * The seven categories, in deck order.
 *
 * Dead End, Obstacle and Trap are three DIFFERENT ways to be
 * stopped, and each ends differently: a Dead End cannot be
 * solved, an Obstacle can be worked on, a Trap resolves at once
 * and leaves the game either way.
 */
export const CATEGORIES: readonly CategoryDef[] = [
  {
    category: 'clear-path', title: 'Clear Path', eyebrow: 'Progress',
    rule: 'Score 1 point. Collect 5 and the party escapes.',
    emphasis: '1 point', copies: 6, shapeCode: 'circle', blocker: false,
  },
  {
    category: 'dead-end', title: 'Dead End', eyebrow: 'Setback',
    rule: 'No check clears it. Only Boost Morale. Blocks the river.',
    emphasis: 'No check clears it.', copies: 4, shapeCode: 'square', blocker: true,
  },
  {
    category: 'obstacle', title: 'Obstacle', eyebrow: 'Blocked',
    rule: 'Stays in the river until an action check resolves it.',
    emphasis: 'Stays in the river', copies: 4, shapeCode: 'bar-h', blocker: true,
  },
  {
    category: 'trap', title: 'Trap', eyebrow: 'Hazard',
    rule: `Check DC ${MAZE_DC} ± 1 at once. Leaves the game either way.`,
    emphasis: `DC ${MAZE_DC} ± 1`, copies: 3, shapeCode: 'triangle', blocker: true,
  },
  {
    category: 'monster', title: 'Monster', eyebrow: 'Threat',
    rule: 'Two revealed forces a confrontation. Beat it and it is gone.',
    emphasis: 'Two revealed', copies: 3, shapeCode: 'eyes', blocker: false,
  },
  {
    category: 'wanderer', title: 'Wanderer', eyebrow: 'Encounter',
    rule: 'A traveller or lost soul. Friend or foe — some stay, some leave.',
    emphasis: 'Friend or foe', copies: 4, shapeCode: 'bar-v', blocker: false,
  },
  {
    category: 'item', title: 'Item', eyebrow: 'Salvage',
    rule: 'Treasure, trinket, or trash. Keep or leave — it discards either way.',
    emphasis: 'discards', copies: 4, shapeCode: 'cross', blocker: false,
  },
];

/** The five abilities, in ability-score order. */
export const ABILITIES: readonly AbilityDef[] = [
  {
    ability: 'forge-a-path', title: 'Forge a Path', score: 'STR', scoreName: 'Strength',
    effect: 'Add 2 Clear Path cards from the reserve into the discard pile.',
    why: 'Deck dilution: lowers threat density for the rest of the run.',
  },
  {
    ability: 'scout-ahead', title: 'Scout Ahead', score: 'DEX', scoreName: 'Dexterity',
    effect: 'Look at the top card of the deck and one river card. Take either.',
    why: 'Buys information and converts it straight into a guaranteed pick.',
  },
  {
    ability: 'its-elementary', title: 'It’s Elementary', score: 'INT', scoreName: 'Intelligence',
    effect: 'Look at the top 3 cards. One to the bottom, two back on top in any order.',
    why: 'Removes the worst immediate danger and sets up the next two turns.',
  },
  {
    ability: 'careful-consideration', title: 'Careful Consideration', score: 'WIS', scoreName: 'Wisdom',
    effect: 'Reveal 2 cards in the river before anyone commits to a choice.',
    why: 'Short-term safety. The cheapest way to not walk into a trap.',
  },
  {
    ability: 'boost-morale', title: 'Boost Morale', score: 'CHA', scoreName: 'Charisma',
    effect: 'Permanently remove one Dead End from the river and replace it.',
    why: 'The only way a Dead End ever leaves the river.',
  },
];

/** Total cards in a standard deck (28). */
export const DECK_TOTAL: number = CATEGORIES.reduce((n, c) => n + c.copies, 0);

/** Look up one category definition. */
export function getCategory(category: CardCategory): CategoryDef {
  const def = CATEGORIES.find((c) => c.category === category);
  if (!def) throw new Error(`Unknown card category: ${category}`);
  return def;
}

/** Look up one ability definition. */
export function getAbility(ability: AbilityKey): AbilityDef {
  const def = ABILITIES.find((a) => a.ability === ability);
  if (!def) throw new Error(`Unknown ability: ${ability}`);
  return def;
}

/** CSS class carrying a category's palette ramp. */
export const CATEGORY_CLASS: Record<CardCategory, string> = {
  'clear-path': 'md-cat-path',
  'dead-end': 'md-cat-dead',
  obstacle: 'md-cat-obst',
  trap: 'md-cat-trap',
  monster: 'md-cat-mons',
  wanderer: 'md-cat-wand',
  item: 'md-cat-item',
};
