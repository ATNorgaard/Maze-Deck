import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backOutside from './art/back-ember-hold-outside.png';
import stillOutside from './art/world-ember-hold-outside.png';
import backInside from './art/back-ember-hold-inside.png';
import stillInside from './art/world-ember-hold-inside.png';

/** Lava fields under a burning mountain, and the dwarven forge inside it. */
export const EMBER_HOLD: Biome = {
  id: 'ember-hold',
  name: 'Ember Hold',
  flavour: 'Lava fields under a burning mountain, and the dwarven forge inside it. A Clear Path is crust cool enough to cross.',
  motif: 'brick',
  light: 'path',
  art: {
    outside: { back: backOutside, still: stillOutside },
    inside: { back: backInside, still: stillInside },
  },
  cards: {
    'clear-path': {
      title: 'Cooled Crust',
      rule: `It holds, and it is cool. Score 1 point; ${ESCAPE_TARGET} and the party is out of the fire.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Lava Channel',
      rule: 'The fire holds the way until somebody spends an action on it.',
      emphasis: 'holds the way',
    },
    wanderer: {
      title: 'Smith',
      rule: 'Friend or foe is the party’s read. Some forge for anyone, some only for kings.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Rune Steel',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Salamander',
      rule: `One strike. At ${ENCOUNTER_AT} the lava rises to meet you.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Lava Lake',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the way.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Thin Crust',
      rule: `Check DC ${MAZE_DC} ± 1 as the crust breaks. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('eh-cp1', 'A crust of black rock over the old flow, grey with ash and cool enough to walk on.'),
      e('eh-cp2', 'A road of black glass, worn smooth by carts, running straight across the burning plain.'),
      e('eh-cp3', 'An ore-cart rail laid through the hall, and a cart on it that still rolls.'),
      e('eh-cp4', 'A bridge of iron chain over the channel, the links as thick as your arm, and cool to the touch.'),
      e('eh-cp5', 'The ash cloud lifts, and there is the far edge of the lava field, and green beyond it.'),
      e('eh-cp6', 'A stair cut in the hall’s wall, lit by a rune that brightens as you climb.'),
    ],
    obstacle: [
      e('eh-ob1', 'A dwarf-king’s statue fallen across the passage, its crucible spilled and set like stone.', 'STR', 0),
      e('eh-ob2', 'Stepping stones of cooling rock across a lava channel, each one a little softer than the last.', 'DEX', 0),
      e('eh-ob3', 'A door of black glass inlaid with burning runes, which spell a name the door will answer to.', 'INT', 1),
      e('eh-ob4', 'Heat like a wall, the air too hot to breathe deep, for as long as it takes to cross the hall.', 'CON', 0),
      e('eh-ob5', 'Smoke across the lava field, and in it the glow of flows moving where you cannot see them.', 'WIS', 1),
      e('eh-ob6', 'A dwarven forge-warden with a hammer, and a long memory of what outsiders did here.', 'CHA', 0),
    ],
    wanderer: [
      e('eh-wa1', 'A soot-black smith resting at an anvil, who will look at your blades and tell you the truth about them.'),
      e('eh-wa2', 'An ash-walker with cloth over her face and a staff of glass, who crosses the fields for a living.'),
      e('eh-wa3', 'A young dwarf who left the hold against orders, and would be glad of company going back.'),
      e('eh-wa4', 'A fire priest feeding offerings into a vent, who says the mountain is listening today.'),
      e('eh-wa5', 'A prospector with a pick and a pocketful of raw gems, who knows where the ground is thin.'),
      e('eh-wa6', 'A figure of cooling rock that walks, slowly, and speaks in the voice of a bellows.'),
    ],
    item: [
      e('eh-it1', 'A rune-axe cooling on the anvil, its runes still glowing, and nobody at the forge.'),
      e('eh-it2', 'Dwarven goggles of smoked glass, which make the glare bearable and the dark visible.'),
      e('eh-it3', 'A flask of what the smiths quench blades in, which also works on burns.'),
      e('eh-it4', 'A shard of black glass with an edge that never dulls.'),
      e('eh-it5', 'An ingot of gold-bright metal that is warm, and stays warm.'),
      e('eh-it6', 'A heat-cloak of grey woven stone, left on a hook at the edge of the fields.'),
    ],
    monster: [
      e('eh-mo1', 'Embers swarming up off the lava field: not drifting with the wind, but against it.'),
      e('eh-mo2', 'The floor cracks, and the cracks glow, and they are spreading toward you.'),
      e('eh-mo3', 'Something swimming in the lava channel, its back breaking the surface like a fish’s.'),
    ],
    'dead-end': [
      e('eh-de1', 'The road of glass ends at a lake of lava, wide and slow and unbroken.'),
      e('eh-de2', 'The hall’s great door, sealed with metal poured into every seam, and long since cold.'),
    ],
    trap: [
      e('eh-tr1', 'The crust breaks, and underneath it the rock is still running.'),
      e('eh-tr2', 'A vent opens under the path in a blast of steam and cinders.'),
    ],
  },
};
