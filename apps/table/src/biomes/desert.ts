import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';

/** Dune lines instead of doors. Nothing here is hidden; it is only far. */
export const DESERT: Biome = {
  id: 'desert',
  name: 'Desert',
  flavour: 'Dune lines instead of doors. Nothing here is hidden; it is only far.',
  motif: 'dune',
  cards: {
    'clear-path': {
      title: 'Caravan Track',
      rule: `The track holds. Score 1 point; ${ESCAPE_TARGET} and the party reaches water.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Slip Face',
      rule: 'The dune holds the way until somebody spends an action on it.',
      emphasis: 'holds the way',
    },
    wanderer: {
      title: 'Nomad',
      rule: 'Friend or foe is the party’s read. Some share the road, some share nothing.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Wreck',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Hunter',
      rule: `One strike. At ${ENCOUNTER_AT} it has your scent and the wind.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Dry Wadi',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the way.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Sinkhole',
      rule: `Check DC ${MAZE_DC} ± 1 the moment you step. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('ds-cp1', 'A line of cairns, one every hundred paces, leading over the next rise.'),
      e('ds-cp2', 'Camel tracks, a lot of them, all going the same way. Where there is a caravan there is water.'),
      e('ds-cp3', 'The sand gives way to hard pan, and walking is suddenly half the work.'),
      e('ds-cp4', 'A dry riverbed with green in the bottom of it. Follow the green.'),
      e('ds-cp5', 'The shadow of a wall on the horizon. Straight edges mean people.'),
      e('ds-cp6', 'A well, stone-lined, with a bucket and rope and a cup on a chain.'),
    ],
    obstacle: [
      e('ds-ob1', 'A rockfall across the wadi. The boulders can be shifted, in this heat, by someone strong.', 'STR', 0),
      e('ds-ob2', 'A dune face steep enough that every step slides two back. It has to be run.', 'DEX', 0),
      e('ds-ob3', 'A caravanserai gate sealed with a merchant’s cipher. The key is written on the door, if you can read it.', 'INT', 1),
      e('ds-ob4', 'The sun, and nothing else. Two hours of open ground with no shade at all.', 'CON', 0),
      e('ds-ob5', 'Mirage. Three roads across the flat and only one of them is there.', 'WIS', 1),
      e('ds-ob6', 'A toll post at the pass, manned by people who have heard every story.', 'CHA', 0),
    ],
    wanderer: [
      e('ds-wa1', 'A caravan master with a broken wheel, twenty camels, and a reasonable offer.'),
      e('ds-wa2', 'A hermit in the shade of a rock, who has been waiting for someone to ask the right question.'),
      e('ds-wa3', 'A girl driving goats toward water. She has never seen strangers and is not afraid of them.'),
      e('ds-wa4', 'A figure walking the other way with no pack, no water, and no footprints behind it.'),
      e('ds-wa5', 'A scout from the tribe that owns this crossing: polite, curious, and counting your weapons.'),
      e('ds-wa6', 'Two travellers sharing one waterskin, who fall silent when you approach and stay that way.'),
    ],
    item: [
      e('ds-it1', 'A waterskin, full, half-buried, with a name burned into the leather.'),
      e('ds-it2', 'A sun-bleached saddle with a compass sewn into the horn that points somewhere other than north.'),
      e('ds-it3', 'A bronze mirror in the sand, still bright, reflecting a sky that has a moon in it.'),
      e('ds-it4', 'A merchant’s strongbox, lock rusted through, holding letters instead of coin.'),
      e('ds-it5', 'A pair of veils that keep out the sand and, somehow, the heat.'),
      e('ds-it6', 'A jar of dates that has kept, sealed with pitch and a prayer.'),
    ],
    monster: [
      e('ds-mo1', 'The sand ahead moves, and there is no wind.'),
      e('ds-mo2', 'Vultures, a lot of them, circling something that is not dead yet.'),
      e('ds-mo3', 'Tracks that cross yours, then follow them.'),
    ],
    'dead-end': [
      e('ds-de1', 'The wadi ends in a cliff face with a stair carved into it that stops halfway up.'),
      e('ds-de2', 'A salt flat that goes to the horizon in every direction, and the horizon is a lie.'),
    ],
    trap: [
      e('ds-tr1', 'The crust breaks and the sand underneath is soft all the way down.'),
      e('ds-tr2', 'A scorpion nest under the shade of the only rock for a mile.'),
    ],
  },
};
