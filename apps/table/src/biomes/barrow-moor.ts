import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backOutside from './art/back-barrow-moor-outside.png';
import stillOutside from './art/world-barrow-moor-outside.png';
import backInside from './art/back-barrow-moor-inside.png';
import stillInside from './art/world-barrow-moor-inside.png';

/** Standing stones and burial mounds at the edge of the Shadowfell, and the tombs inside them. */
export const BARROW_MOOR: Biome = {
  id: 'barrow-moor',
  name: 'Barrow moor',
  flavour: 'Standing stones and burial mounds at the edge of the Shadowfell. A Clear Path is the way between the stones.',
  motif: 'stair',
  light: 'wand',
  art: {
    outside: { back: backOutside, still: stillOutside },
    inside: { back: backInside, still: stillInside },
  },
  cards: {
    'clear-path': {
      title: 'Stone Way',
      rule: `The stones lead on. Score 1 point; ${ESCAPE_TARGET} and the party is off the moor before moonset.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Sealed Door',
      rule: 'The door holds the way until somebody spends an action on it.',
      emphasis: 'holds the way',
    },
    wanderer: {
      title: 'Gravedigger',
      rule: 'Friend or foe is the party’s read. Some tend the dead, some are still deciding.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Grave Goods',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Wight',
      rule: `One strike. At ${ENCOUNTER_AT} the mounds open.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Stone Ring',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the way.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Open Grave',
      rule: `Check DC ${MAZE_DC} ± 1 as the turf gives. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('bm-cp1', 'A line of standing stones across the moor, each in sight of the next, and the moon on all of them.'),
      e('bm-cp2', 'A sunken lane between banks of heather, walled in old stone, that the mist does not fill.'),
      e('bm-cp3', 'The ruined chapel’s lychgate, and through it the path the dead were carried down, swept clean.'),
      e('bm-cp4', 'A passage between the barrow’s great stones, the roof low, and at the end a draught that smells of grass.'),
      e('bm-cp5', 'Crows lifting off the stones ahead and settling again further on, as if they were leading.'),
      e('bm-cp6', 'A shepherd’s fire on the far hill. Where there are sheep, there is a way down.'),
    ],
    obstacle: [
      e('bm-ob1', 'A capstone fallen across the tomb’s passage, which has to be lifted before anyone goes on.', 'STR', 0),
      e('bm-ob2', 'A bog in the hollow, and the way across it on stones laid by people who knew where to step.', 'DEX', 0),
      e('bm-ob3', 'A sealed tomb door carved with the barrow-king’s names, one of which opens it.', 'INT', 1),
      e('bm-ob4', 'The cold of the moor at night, soaking in, and the mist that takes the warmth out of everything.', 'CON', 0),
      e('bm-ob5', 'Whispers in the mist, saying your names, and only some of them in your friends’ voices.', 'WIS', 1),
      e('bm-ob6', 'The barrow’s warden, a ghost who keeps the door and will hear one good reason.', 'CHA', 0),
    ],
    wanderer: [
      e('bm-wa1', 'The gravedigger, with a lantern and a spade, who has dug here forty years and never filled the same grave twice.'),
      e('bm-wa2', 'A mourner in black at a fresh mound, who will not say whose it is.'),
      e('bm-wa3', 'A scholar copying the carvings on the stones by moonlight, who needs someone to hold the lamp.'),
      e('bm-wa4', 'A child among the stones who says she is waiting for her grandmother, and casts no shadow.'),
      e('bm-wa5', 'A priest of the dead ringing a hand bell, walking the boundary so that nothing crosses it.'),
      e('bm-wa6', 'A tomb robber with a sack that clinks, coming out of the mound just as you come up to it.'),
    ],
    item: [
      e('bm-it1', 'Grave goods on a coffin lid: a bronze sword, green with age, and still sharp.'),
      e('bm-it2', 'A silver bell on a ribbon, the kind tied to the dead so they can be heard if they wake.'),
      e('bm-it3', 'A torc of twisted gold, too heavy for the neck it was made for.'),
      e('bm-it4', 'A lantern of blue glass that shows what the mist is hiding.'),
      e('bm-it5', 'A bundle of rowan sprigs and red thread, tied by someone who knew what walks here.'),
      e('bm-it6', 'Coins on the eyes of a stone effigy, older than any kingdom you know.'),
    ],
    monster: [
      e('bm-mo1', 'Ghost-lights drifting in from the mounds, low over the heather, toward your light.'),
      e('bm-mo2', 'The turf of the nearest barrow settling, as if something under it had turned over.'),
      e('bm-mo3', 'Mist round the ankles, cold as fingers, and a voice at the back of the party that is not one of you.'),
    ],
    'dead-end': [
      e('bm-de1', 'A ring of stones, and every way out of it leads back in.'),
      e('bm-de2', 'The passage ends at the barrow-king’s bier, and the walls behind it are solid earth.'),
    ],
    trap: [
      e('bm-tr1', 'The turf gives way into an open grave, and the earth at the bottom is soft.'),
      e('bm-tr2', 'A tripwire of old bronze across the tomb’s door, and the roof above it already cracked.'),
    ],
  },
};
