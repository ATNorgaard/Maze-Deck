import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backOutside from './art/back-kings-road-outside.png';
import stillOutside from './art/world-kings-road-outside.png';

/** The road between towns, and everything that happens on it after dark. */
export const KINGS_ROAD: Biome = {
  id: 'kings-road',
  name: 'King’s Road',
  flavour: 'Four ways at a crossroads and a lamp on the signpost. A Clear Path is the road going on under the first stars.',
  motif: 'fret',
  light: 'path',
  art: {
    outside: { back: backOutside, still: stillOutside },
  },
  cards: {
    'clear-path': {
      title: 'Open Road',
      rule: `The road runs on. Score 1 point; ${ESCAPE_TARGET} and the party sees the next town’s lights.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Toll Chain',
      rule: 'The chain holds the road until somebody spends an action on it.',
      emphasis: 'holds the road',
    },
    wanderer: {
      title: 'Pedlar',
      rule: 'Friend or foe is the party’s read. Some sell you news, some sell you out.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Ditch Find',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Night Rider',
      rule: `One strike. At ${ENCOUNTER_AT} the hoofbeats stop beside you.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Broken Bridge',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the road.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Mantrap',
      rule: `Check DC ${MAZE_DC} ± 1 as the jaws close. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('kr-cp1', 'A milestone, and the number on it is smaller than you feared.'),
      e('kr-cp2', 'Cart ruts, fresh, and the smell of bread from somewhere over the hill.'),
      e('kr-cp3', 'A signpost with all four arms still on it, and one of them names where you are going.'),
      e('kr-cp4', 'The road leaves the trees and runs straight between the wheat, with the first stars over it.'),
      e('kr-cp5', 'A carter going your way, with room in the back if nobody minds the turnips.'),
      e('kr-cp6', 'The lamp on the next post is lit. Somebody tends this road.'),
    ],
    obstacle: [
      e('kr-ob1', 'A hay wain overturned across the road, its oxen gone and its load spilled over the stones.', 'STR', 0),
      e('kr-ob2', 'The bridge is out, and what is left of it is three beams over fast water.', 'DEX', 0),
      e('kr-ob3', 'A toll gate with the lord’s lock and the lord’s seal on it. The lock is a good deal older than the lord.', 'INT', 1),
      e('kr-ob4', 'Rain, all night, on a road with no inn, and twelve more miles of it.', 'CON', 0),
      e('kr-ob5', 'A crossroads in the fog with the signpost gone, and four roads that all look like the right one.', 'WIS', 1),
      e('kr-ob6', 'A toll chain across the road and a lord’s men beside it: bored, armed, and open to argument.', 'CHA', 0),
    ],
    wanderer: [
      e('kr-wa1', 'A pedlar with too many pots, who knows the news from three towns and will trade it for yours.'),
      e('kr-wa2', 'A pilgrim walking barefoot to a shrine you have never heard of, and singing about it.'),
      e('kr-wa3', 'A king’s messenger with a lame horse and a sealed letter he must not be late with.'),
      e('kr-wa4', 'A family on the road with everything they own on one cart, going anywhere but back.'),
      e('kr-wa5', 'A hooded rider who keeps pace with you on the far side of the hedge, and does not speak.'),
      e('kr-wa6', 'A tinker mending a pot at a roadside fire, who has a pot for you, and a question.'),
    ],
    item: [
      e('kr-it1', 'A purse in the ditch, cut from somebody’s belt, with the coins still in it.'),
      e('kr-it2', 'A lantern hung on a gatepost, full of oil, as if left for whoever came next.'),
      e('kr-it3', 'A traveller’s map scratched on a shrine’s wall, with the inns marked and one of them crossed out.'),
      e('kr-it4', 'A good wool cloak on a scarecrow, which the scarecrow will not miss.'),
      e('kr-it5', 'A sack of seed corn fallen from a cart, with a horseshoe tied to its neck for luck.'),
      e('kr-it6', 'A sealed letter in the mud, addressed to someone in the town ahead, and worth something to them.'),
    ],
    monster: [
      e('kr-mo1', 'The gibbet swings on its chain, and there is no wind.'),
      e('kr-mo2', 'A howl from the wheat on one side of the road, answered from the other.'),
      e('kr-mo3', 'Hoofbeats behind you, unhurried, and when you look back the rider has no head.'),
    ],
    'dead-end': [
      e('kr-de1', 'The road ends at a ford in flood: brown water to the horizon, and the far bank gone.'),
      e('kr-de2', 'A gate across the road with the king’s writ nailed to it. Closed by order, for plague.'),
    ],
    trap: [
      e('kr-tr1', 'A mantrap under the leaves at the roadside, set for poachers, and not particular.'),
      e('kr-tr2', 'The verge gives way into a dry well that the grass had grown over.'),
    ],
  },
};
