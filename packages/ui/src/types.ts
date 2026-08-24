/* ============================================================
   MAZE DECK — shared types and the deck definition.
   The composition lives here and nowhere else; every component
   and every count reads from it.

   Canon is 23 cards across five categories. Dead End and Trap
   are our own additions: they keep their art and their rules
   but are marked `expansion` and sit outside the standard deck
   until a run opts into them. See docs/reference/canonical-rules.md.
   ============================================================ */

/** The five categories in a standard deck. */
export type CanonicalCategory =
  | 'clear-path'
  | 'obstacle'
  | 'wanderer'
  | 'item'
  | 'monster';

/** Our own additions. Outside the standard deck. */
export type ExpansionCategory = 'dead-end' | 'trap';

/** Every category the system can draw. */
export type CardCategory = CanonicalCategory | ExpansionCategory;

/** The six ability-keyed actions — one per ability score. */
export type AbilityKey =
  | 'forge-a-path'
  | 'scout-ahead'
  | 'steel-yourself'
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
  /** Copies of this card when the category is in play. */
  copies: number;
  /** Redundant, colour-independent corner mark. */
  shapeCode: 'circle' | 'square' | 'bar-h' | 'triangle' | 'eyes' | 'bar-v' | 'cross';
  /** True for cards that sit in the river until something clears them. */
  blocker: boolean;
  /** Outside the standard 23-card deck. Opt in per run. */
  expansion: boolean;
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
export const MAZE_DC = 15;

/** The river is always this many cards wide. */
export const RIVER_WIDTH = 3;

/** Clear Paths needed to get the party through. */
export const ESCAPE_TARGET = 5;

/** Strikes before the party is found and an encounter begins. */
export const ENCOUNTER_AT = 2;

/** Obstacles filling the river at once: clear them all, and a Monster follows. */
export const OBSTACLE_JAM = 3;

/**
 * The categories, in deck order.
 *
 * Obstacle covers every way the maze says "not yet" — hazard,
 * puzzle, trap, locked door. It is the only standard card that
 * stays in the river, which is what makes three of them a crisis.
 */
export const CATEGORIES: readonly CategoryDef[] = [
  {
    category: 'clear-path', title: 'Clear Path', eyebrow: 'Progress',
    rule: `Score 1 point. Collect ${ESCAPE_TARGET} and the party is through.`,
    emphasis: '1 point', copies: 5, shapeCode: 'circle',
    blocker: false, expansion: false,
  },
  {
    category: 'obstacle', title: 'Obstacle', eyebrow: 'Blocked',
    rule: 'Stays in the river until somebody spends an action on it.',
    emphasis: 'Stays in the river', copies: 5, shapeCode: 'bar-h',
    blocker: true, expansion: false,
  },
  {
    category: 'wanderer', title: 'Wanderer', eyebrow: 'Encounter',
    rule: 'Friend or foe is the party’s read. Some linger, some move on.',
    emphasis: 'Friend or foe', copies: 5, shapeCode: 'bar-v',
    blocker: false, expansion: false,
  },
  {
    category: 'item', title: 'Item', eyebrow: 'Salvage',
    rule: 'Take it or leave it. The card is discarded either way.',
    emphasis: 'discarded either way', copies: 5, shapeCode: 'cross',
    blocker: false, expansion: false,
  },
  {
    category: 'monster', title: 'Monster', eyebrow: 'Threat',
    rule: `One strike. At ${ENCOUNTER_AT} the party is found.`,
    emphasis: 'One strike', copies: 3, shapeCode: 'eyes',
    blocker: false, expansion: false,
  },

  /* ---- expansion: ours, not standard ---- */
  {
    category: 'dead-end', title: 'Dead End', eyebrow: 'Setback',
    rule: 'No check clears it. Only a rallied party turns back. Blocks the river.',
    emphasis: 'No check clears it.', copies: 4, shapeCode: 'square',
    blocker: true, expansion: true,
  },
  {
    category: 'trap', title: 'Trap', eyebrow: 'Hazard',
    rule: `Check DC ${MAZE_DC} ± 1 at once. Leaves the game either way.`,
    emphasis: `DC ${MAZE_DC} ± 1`, copies: 3, shapeCode: 'triangle',
    blocker: true, expansion: true,
  },
];

/** The five standard categories, in deck order. */
export const CANONICAL_CATEGORIES: readonly CategoryDef[] =
  CATEGORIES.filter((c) => !c.expansion);

/**
 * The six actions, in ability-score order.
 *
 * Three of them reach into the deck and only one touches the
 * river directly — the maze is beaten by managing what is coming,
 * not by staring at what has arrived.
 */
export const ABILITIES: readonly AbilityDef[] = [
  {
    ability: 'forge-a-path', title: 'Forge a Path', score: 'STR', scoreName: 'Strength',
    effect: 'Two Clear Path cards enter the discard pile from reserve.',
    why: 'Thins the danger in every turn that follows, once the discard comes back around.',
  },
  {
    ability: 'scout-ahead', title: 'Scout Ahead', score: 'DEX', scoreName: 'Dexterity',
    effect: 'Draw 3. One goes back on top of the deck; the other 2 shuffle back in.',
    why: 'Buys the next card outright instead of gambling on it.',
  },
  {
    ability: 'steel-yourself', title: 'Steel Yourself', score: 'CON', scoreName: 'Constitution',
    effect: 'Sweep all 3 river cards into the discard and deal 3 fresh ones.',
    why: 'The only way out of a river that has gone bad.',
  },
  {
    ability: 'its-elementary', title: 'It’s Elementary', score: 'INT', scoreName: 'Intelligence',
    effect: 'Draw 2. Swap 1 into the river; the rest go back on top of the deck.',
    why: 'Replaces the worst thing in front of the party with something chosen.',
  },
  {
    ability: 'careful-consideration', title: 'Careful Consideration', score: 'WIS', scoreName: 'Wisdom',
    effect: 'Reveal 2 river cards and discard 1, then shuffle what is left back face down.',
    why: 'The cheapest way to not walk into the obvious.',
  },
  {
    ability: 'boost-morale', title: 'Boost Morale', score: 'CHA', scoreName: 'Charisma',
    effect: 'Grant another character advantage on their next check or save.',
    why: 'The only action a player spends on somebody else.',
  },
];

/** Cards in a standard deck (23). Expansion categories are not counted. */
export const DECK_TOTAL: number =
  CANONICAL_CATEGORIES.reduce((n, c) => n + c.copies, 0);

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
  obstacle: 'md-cat-obst',
  wanderer: 'md-cat-wand',
  item: 'md-cat-item',
  monster: 'md-cat-mons',
  'dead-end': 'md-cat-dead',
  trap: 'md-cat-trap',
};
