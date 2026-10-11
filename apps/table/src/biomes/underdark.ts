import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backInside from './art/back-underdark-inside.png';
import stillInside from './art/world-underdark-inside.png';

/** Miles below: a cavern so big it has weather. */
export const UNDERDARK: Biome = {
  id: 'underdark',
  name: 'Underdark',
  flavour: 'Miles below, a cavern so big it has its own weather. A Clear Path is the silk bridge holding.',
  motif: 'crystal',
  light: 'wand',
  art: {
    inside: { back: backInside, still: stillInside },
  },
  cards: {
    'clear-path': {
      title: 'Silk Bridge',
      rule: `The bridge holds. Score 1 point; ${ESCAPE_TARGET} and the party finds the way up.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Web Wall',
      rule: 'The web holds the way until somebody spends an action on it.',
      emphasis: 'holds the way',
    },
    wanderer: {
      title: 'Deep Gnome',
      rule: 'Friend or foe is the party’s read. Some share the dark, some sell you to it.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Glow Geode',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Many-Legs',
      rule: `One strike. At ${ENCOUNTER_AT} the threads come down out of the dark.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Chasm',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the way.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Spore Cloud',
      rule: `Check DC ${MAZE_DC} ± 1 as the puffball bursts. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('ud-cp1', 'The silk bridge, grey and taut over the chasm, and it does not sway under the first step.'),
      e('ud-cp2', 'A trail of glowing lichen along the cavern wall, as straight as if somebody planted it.'),
      e('ud-cp3', 'A boat on the black lake, and a pole, and on the far shore the light of the fungus forest.'),
      e('ud-cp4', 'A draught on your face, from somewhere above, that smells of rain.'),
      e('ud-cp5', 'A deep gnome’s waymark scratched on a stalagmite: three lines and a circle, meaning safe.'),
      e('ud-cp6', 'A stair of shelf fungus up the cliff, each shelf strong enough to stand on.'),
    ],
    obstacle: [
      e('ud-ob1', 'A wall of web across the tunnel, each strand as thick as a rope and twice as strong.', 'STR', 0),
      e('ud-ob2', 'A crossing on bare spider silk with no handline, and under it a chasm with no bottom you can see.', 'DEX', 0),
      e('ud-ob3', 'A drow ward on the passage: glyphs that wake when anything with a heartbeat comes near.', 'INT', 1),
      e('ud-ob4', 'Air that is thin and stale and tastes of metal, for a long way.', 'CON', 0),
      e('ud-ob5', 'Dark so complete that the fungus glow is the only map, and the fungus moves.', 'WIS', 1),
      e('ud-ob6', 'A drow patrol at a chokepoint with their crossbows already loaded, waiting to be persuaded.', 'CHA', 0),
    ],
    wanderer: [
      e('ud-wa1', 'A deep gnome with a pick and a pack of gems, who knows three ways up and trusts none of them.'),
      e('ud-wa2', 'An exiled drow, alone, very good with the sword she carries, who would like company that is not her own kind.'),
      e('ud-wa3', 'A myconid that speaks in spores, and for a moment the whole party dreams the same thing.'),
      e('ud-wa4', 'A surface-dweller who came down years ago and has forgotten what the sun is.'),
      e('ud-wa5', 'A duergar trader with a collar and chain on a hook at his belt, and a smile for everyone.'),
      e('ud-wa6', 'A fisher on the black lake, with a line going down into the water and something on the end of it.'),
    ],
    item: [
      e('ud-it1', 'A geode split open and glowing blue-white from inside, bright enough to read by.'),
      e('ud-it2', 'A coil of spider-silk rope, light as a cord and strong as a chain.'),
      e('ud-it3', 'A drow cloak the colour of nothing, which hides whoever wears it.'),
      e('ud-it4', 'A pouch of edible fungus, with a gnome’s note on which kinds not to eat.'),
      e('ud-it5', 'A map of the deep ways scratched on a slate, with the way up marked by a sun.'),
      e('ud-it6', 'A crystal that hums when it is pointed toward open air.'),
    ],
    monster: [
      e('ud-mo1', 'Threads coming down out of the dark overhead, one by one, with something on each.'),
      e('ud-mo2', 'Eyes in the dark beyond the fungus light, clustered in eights.'),
      e('ud-mo3', 'The fungus light going out behind you, patch by patch, as if something were eating it.'),
    ],
    'dead-end': [
      e('ud-de1', 'The tunnel ends at a chasm too wide for any bridge, with a wind coming up from below.'),
      e('ud-de2', 'A lake with no far shore, black and still, and the cavern roof coming down to meet it.'),
    ],
    trap: [
      e('ud-tr1', 'A puffball the size of a barrel, and it bursts.'),
      e('ud-tr2', 'The silk under your feet is sticky. It is not a bridge; it is a web.'),
    ],
  },
};
