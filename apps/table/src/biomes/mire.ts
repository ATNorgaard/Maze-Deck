import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backOutside from './art/back-mire-outside.png';
import stillOutside from './art/world-mire-outside.png';

/** Black water, dead trees, and a causeway that sinks. */
export const MIRE: Biome = {
  id: 'mire',
  name: 'Mire',
  flavour: 'Black water, dead trees and a causeway that sinks. A Clear Path is ground that takes your weight.',
  motif: 'branch',
  light: 'obst',
  art: {
    outside: { back: backOutside, still: stillOutside },
  },
  cards: {
    'clear-path': {
      title: 'Firm Ground',
      rule: `It takes your weight. Score 1 point; ${ESCAPE_TARGET} and the party is out of the bog.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Sunk Causeway',
      rule: 'The water holds the way until somebody spends an action on it.',
      emphasis: 'holds the way',
    },
    wanderer: {
      title: 'Bog Witch',
      rule: 'Friend or foe is the party’s read. Some light the way, some light it wrong.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Bottle Tree',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Drowner',
      rule: `One strike. At ${ENCOUNTER_AT} the water closes over the lights.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Deep Water',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the way.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Sucking Mud',
      rule: `Check DC ${MAZE_DC} ± 1 as it takes your boot. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('mi-cp1', 'A line of old stakes driven into the mud, close together. Someone built a path here once, and some of it is still under the water.'),
      e('mi-cp2', 'Firm ground: a hummock of tussock grass, then another, a stride apart.'),
      e('mi-cp3', 'The marsh-light hangs steady over the next stretch of causeway, and the planks under it are dry.'),
      e('mi-cp4', 'A punt pulled up on the reeds with its pole beside it, and open water running the way you are going.'),
      e('mi-cp5', 'Herons standing in the shallows in a line. Where they can stand, you can wade.'),
      e('mi-cp6', 'The fog thins, and there is a stilt hut with a lit window and a ladder down to a boardwalk.'),
    ],
    obstacle: [
      e('mi-ob1', 'A fallen cypress across the channel, too big to climb and too rotten to trust. It has to be moved.', 'STR', 0),
      e('mi-ob2', 'The causeway is gone for twenty yards, and what is left is the tops of the piles, a jump apart.', 'DEX', 0),
      e('mi-ob3', 'A lock-gate on an old drainage dyke, its windlass seized and its paddles marked in a code of notches.', 'INT', 1),
      e('mi-ob4', 'Wading to the waist through water colder than it looks, and full of things that bite.', 'CON', 0),
      e('mi-ob5', 'Three wisps over three ways through the reeds, and only one of them is over solid ground.', 'WIS', 1),
      e('mi-ob6', 'Stilt huts on both banks of the channel, and the people on the porches decide who passes.', 'CHA', 0),
    ],
    wanderer: [
      e('mi-wa1', 'A bog witch with a lantern and a basket of something still moving, who knows the way and wants a favour for it.'),
      e('mi-wa2', 'An eel-catcher in a coracle, who talks to the water and seems to get answers.'),
      e('mi-wa3', 'A knight in rusted armour, lost on the causeway for longer than he will say.'),
      e('mi-wa4', 'A child poling a punt alone, who says her mother is just ahead, and keeps saying it.'),
      e('mi-wa5', 'A peat-cutter with a spade over his shoulder, who has found something in the bog he would like you to look at.'),
      e('mi-wa6', 'A pale figure standing in the water to the knees, quite still, watching the light you carry.'),
    ],
    item: [
      e('mi-it1', 'A bottle tree by the path, every bottle stoppered, and one of them with a folded map inside.'),
      e('mi-it2', 'A lantern on a pole, the kind the marsh folk set out to mark the safe ways.'),
      e('mi-it3', 'A pair of stilts, well made, leaning against a dead tree.'),
      e('mi-it4', 'A charm of woven reed and bone on a post, against the things in the water.'),
      e('mi-it5', 'A coil of good rope, tarred against the wet, on a stake where somebody left it.'),
      e('mi-it6', 'Something the bog gave up: a bronze torc, green with age, still gleaming at one edge.'),
    ],
    monster: [
      e('mi-mo1', 'The wisps drift closer to the causeway, more of them, all at once.'),
      e('mi-mo2', 'Bubbles rising in a line across the channel, coming your way.'),
      e('mi-mo3', 'A hand breaks the surface beside the boards, and slides back under.'),
    ],
    'dead-end': [
      e('mi-de1', 'The causeway runs out into open water, and the planks go on down into it, out of sight.'),
      e('mi-de2', 'Reeds taller than a man in every direction, and every way through them comes back here.'),
    ],
    trap: [
      e('mi-tr1', 'The mud takes a leg to the knee, and keeps pulling.'),
      e('mi-tr2', 'A bubble the size of a barrel breaks under the boards, and what comes out of it is not air.'),
    ],
  },
};
