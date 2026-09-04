import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';

/** Switchbacks in whiteout. Whatever lives up here is heard long before it is seen. */
export const FROZEN_PASS: Biome = {
  id: 'frozen-pass',
  name: 'Frozen pass',
  flavour: 'Switchbacks in whiteout. Whatever lives up here is heard long before it is seen.',
  motif: 'crystal',
  cards: {
    'clear-path': {
      title: 'Switchback',
      rule: `The pass climbs on. Score 1 point; ${ESCAPE_TARGET} and the party is over the top.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Cornice',
      rule: 'Holds the pass until somebody spends an action on it.',
      emphasis: 'Holds the pass',
    },
    wanderer: {
      title: 'Pilgrim',
      rule: 'Friend or foe is the party’s read. Some rope in with you, some vanish into the white.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Frozen Pack',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Howler',
      rule: `One strike. At ${ENCOUNTER_AT} the howling stops, which is worse.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Crevasse',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the pass.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Snow Bridge',
      rule: `Check DC ${MAZE_DC} ± 1 as it gives. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('fp-cp1', 'A cairn, and past it the wind drops. You are on the lee side of something.'),
      e('fp-cp2', 'A rope, fixed to iron pins, running up the next pitch. Somebody came this way and meant to come back.'),
      e('fp-cp3', 'The cloud breaks and for a moment you can see the far side of the pass and the valley below it.'),
      e('fp-cp4', 'Footprints, filling in, but going up.'),
      e('fp-cp5', 'A shrine cut into the rock with a candle stub in it. The candle is not old.'),
      e('fp-cp6', 'The switchbacks end. Ahead is a straight climb, and at the top of it, sky.'),
    ],
    obstacle: [
      e('fp-ob1', 'A boulder come down across the path, with a drop on one side and the mountain on the other.', 'STR', 0),
      e('fp-ob2', 'A traverse across an ice slope with nothing to hold and a long way to fall.', 'DEX', 0),
      e('fp-ob3', 'A cache of climbing gear frozen into the ice. Getting it out means understanding how the ice moves.', 'INT', 1),
      e('fp-ob4', 'The wind. An hour of it, head on, and the cold going into the bone.', 'CON', 0),
      e('fp-ob5', 'Whiteout. The path is under a foot of new snow and the cairns have gone.', 'WIS', 1),
      e('fp-ob6', 'A watch post at the top of the pitch, and the watch does not like the look of you.', 'CHA', 0),
    ],
    wanderer: [
      e('fp-wa1', 'A guide with a rope and a price, who came down this morning and knows what is on top.'),
      e('fp-wa2', 'A monk from the monastery over the pass, unhurried, walking barefoot in the snow.'),
      e('fp-wa3', 'A soldier of an army that has not existed for a century, still holding the line.'),
      e('fp-wa4', 'A trapper with a sledge, dogs, and a story about the thing that took one of them.'),
      e('fp-wa5', 'Something white and tall that walks the ridgeline parallel to the path and never comes closer.'),
      e('fp-wa6', 'Two climbers roped together, one of whom is not moving.'),
    ],
    item: [
      e('fp-it1', 'A pack, frozen into a drift, with a week of food and somebody’s letters home.'),
      e('fp-it2', 'An ice axe, good steel, driven into the snow as a marker. The rope it was holding is gone.'),
      e('fp-it3', 'A flask of something that burns going down and keeps burning for an hour.'),
      e('fp-it4', 'A pair of snow goggles cut from bone, which make the white readable.'),
      e('fp-it5', 'A lantern that burns with no flame and gives off heat instead of light.'),
      e('fp-it6', 'A silver whistle on a cord, frozen to the rock. Something up here answers to it.'),
    ],
    monster: [
      e('fp-mo1', 'A howl, far off. Then another, closer, answering it.'),
      e('fp-mo2', 'The snow on the slope above you shifts, and it is not the wind.'),
      e('fp-mo3', 'Tracks in the new snow, three-toed, crossing the path and returning to it.'),
    ],
    'dead-end': [
      e('fp-de1', 'The path ends at a crevasse with no bottom you can see and no bridge that will hold.'),
      e('fp-de2', 'A rock wall, sheer, with a rope hanging down it that ends twenty feet above your head.'),
    ],
    trap: [
      e('fp-tr1', 'The snow bridge holds for the first three of you and not the fourth.'),
      e('fp-tr2', 'The cornice you were standing on is now a cornice you are falling with.'),
    ],
  },
};
