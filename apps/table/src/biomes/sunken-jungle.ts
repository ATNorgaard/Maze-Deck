import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backOutside from './art/back-sunken-jungle-outside.png';
import stillOutside from './art/world-sunken-jungle-outside.png';
import backInside from './art/back-sunken-jungle-inside.png';
import stillInside from './art/world-sunken-jungle-inside.png';

/** A step pyramid swallowed by the jungle, and the temple inside it. */
export const SUNKEN_JUNGLE: Biome = {
  id: 'sunken-jungle',
  name: 'Sunken jungle',
  flavour: 'A step pyramid swallowed by the jungle, and the temple inside it. A Clear Path is sunlight down the stair.',
  motif: 'branch',
  light: 'path',
  art: {
    outside: { back: backOutside, still: stillOutside },
    inside: { back: backInside, still: stillInside },
  },
  cards: {
    'clear-path': {
      title: 'Sunlit Stair',
      rule: `The sun finds the way. Score 1 point; ${ESCAPE_TARGET} and the party is out from under the canopy.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Fallen Stair',
      rule: 'The stones hold the way until somebody spends an action on them.',
      emphasis: 'hold the way',
    },
    wanderer: {
      title: 'Guide',
      rule: 'Friend or foe is the party’s read. Some know the way, some know the temple’s price.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Idol',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Great Serpent',
      rule: `One strike. At ${ENCOUNTER_AT} the vines move, and they are not vines.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Sealed Vault',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the way.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Dart Wall',
      rule: `Check DC ${MAZE_DC} ± 1 as the stone clicks. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('sj-cp1', 'Sunlight down the pyramid’s stair through a gap in the canopy, every step clear.'),
      e('sj-cp2', 'A rope bridge between the great trees, old but mended, high above the undergrowth.'),
      e('sj-cp3', 'A stream running out of the temple’s mouth, and a ledge beside it dry enough to walk.'),
      e('sj-cp4', 'An old road under the leaf litter, paved, its stones still level after a thousand years.'),
      e('sj-cp5', 'Monkeys in the canopy, all going one way, and loud about it.'),
      e('sj-cp6', 'A serpent carved on the wall, its head pointing down a passage where the air moves.'),
    ],
    obstacle: [
      e('sj-ob1', 'A stair collapsed into rubble, and the blocks that fell are the size of carts.', 'STR', 0),
      e('sj-ob2', 'Roots across a chasm in the temple floor, slick with moss, the only way over.', 'DEX', 0),
      e('sj-ob3', 'A door with a calendar carved round it, and the day it opens on is today, if you can read it.', 'INT', 1),
      e('sj-ob4', 'Heat and wet and insects, all afternoon, through jungle that has to be cut at every step.', 'CON', 0),
      e('sj-ob5', 'Every trail in the undergrowth looks the same, and the canopy hides the sun.', 'WIS', 1),
      e('sj-ob6', 'The canopy people, painted, watching from the trees to see what kind of strangers these are.', 'CHA', 0),
    ],
    wanderer: [
      e('sj-wa1', 'A guide in a feathered cloak who knows the jungle and charges by the day, in advance.'),
      e('sj-wa2', 'An explorer with a sun hat and a notebook, delighted to see anyone at all, and lost.'),
      e('sj-wa3', 'A temple keeper, the last of them, who still sweeps the steps every morning.'),
      e('sj-wa4', 'A hunter with a blowpipe, who will not speak above a whisper, and points at the trees.'),
      e('sj-wa5', 'A rival party’s porter, alone, who says the others went into the temple yesterday.'),
      e('sj-wa6', 'A child with a pet monkey, who leads you to the edge of the clearing and will go no further.'),
    ],
    item: [
      e('sj-it1', 'The gold idol on its altar, and nothing obviously holding it there.'),
      e('sj-it2', 'A machete, well kept, stuck in a tree where somebody left it in a hurry.'),
      e('sj-it3', 'A jade mask from the temple, through which its wearer sees in the dark.'),
      e('sj-it4', 'A coil of rope twisted from vine fibre, light and strong, on a peg by a hunter’s blind.'),
      e('sj-it5', 'A gourd of the bitter tea the jungle people drink against fever.'),
      e('sj-it6', 'A carved stone key, shaped like a serpent biting its own tail.'),
    ],
    monster: [
      e('sj-mo1', 'The birds stop, all of them, across the whole canopy, at once.'),
      e('sj-mo2', 'A trail through the undergrowth as wide as a cart, freshly flattened, and it curves.'),
      e('sj-mo3', 'Eyes in the leaves on both sides of the path, at the height of a man’s.'),
    ],
    'dead-end': [
      e('sj-de1', 'The passage ends at a wall carved with every face of the god, and none of them is a door.'),
      e('sj-de2', 'The trail runs out at a gorge, and the bridge is a single rope with nothing on it.'),
    ],
    trap: [
      e('sj-tr1', 'A stone clicks underfoot, and the walls are full of little holes.'),
      e('sj-tr2', 'The temple floor tilts, slowly, toward a channel of fast black water.'),
    ],
  },
};
