import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';

/** Game trails that all look the same. The trees are older than the road, and they know it. */
export const DEEP_FOREST: Biome = {
  id: 'deep-forest',
  name: 'Deep forest',
  flavour: 'Game trails that all look the same. The trees are older than the road, and they know it.',
  motif: 'branch',
  cards: {
    'clear-path': {
      title: 'Game Trail',
      rule: `The trail holds. Score 1 point; ${ESCAPE_TARGET} and the party is out of the trees.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Deadfall',
      rule: 'Blocks the trail until somebody spends an action cutting it.',
      emphasis: 'Blocks the trail',
    },
    wanderer: {
      title: 'Watcher',
      rule: 'Friend or foe is the party’s read. Some walk with you, some melt back into the trees.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Cache',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Stalker',
      rule: `One strike. At ${ENCOUNTER_AT} it stops stalking and comes in.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Thicket',
      rule: 'No check cuts it. Only a rallied party turns back. Blocks the trail.',
      emphasis: 'No check cuts it.',
    },
    trap: {
      title: 'Snare',
      rule: `Check DC ${MAZE_DC} ± 1 at once. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('df-cp1', 'The trail widens into an old road, cobbles showing through the moss. The forest has not quite finished eating it.'),
      e('df-cp2', 'Birdsong ahead, for the first time since you went under the canopy.'),
      e('df-cp3', 'A blaze cut into a trunk at shoulder height, old but deliberate. Whoever marked it was going your way.'),
      e('df-cp4', 'A stream crossing with flat stones set in it. Somebody wanted this crossed dry.'),
      e('df-cp5', 'The trees thin, and the light goes from green to gold.'),
      e('df-cp6', 'A hunter’s shelter, empty, with the path continuing past its door.'),
    ],
    obstacle: [
      e('df-ob1', 'A fallen oak across the trail, too big to climb through and too tangled to go round.', 'STR', 0),
      e('df-ob2', 'The trail runs along a ledge above a ravine, and half of it has slid into the ravine.', 'DEX', 0),
      e('df-ob3', 'A ring of standing stones the trail passes through, and the far side is not where the near side says it should be.', 'INT', 1),
      e('df-ob4', 'Bog. Waist-deep, cold, and the trail simply goes into it and out the other side.', 'CON', 0),
      e('df-ob5', 'Three trails leave the clearing and all of them are marked with the same blaze.', 'WIS', 1),
      e('df-ob6', 'A warden of the wood, in the way, who has not decided yet whether the party is a problem.', 'CHA', 0),
    ],
    wanderer: [
      e('df-wa1', 'A charcoal burner tending a mound, who has not seen a soul in a month and talks like it.'),
      e('df-wa2', 'A stag that does not run. It watches, turns, and walks ahead of you at exactly your pace.'),
      e('df-wa3', 'A child in a red hood, alone, who knows the way and will not say how.'),
      e('df-wa4', 'A poacher with two hares and a warning about the next mile.'),
      e('df-wa5', 'Something tall between the trees that is only there when nobody is looking straight at it.'),
      e('df-wa6', 'Two foresters arguing over a map, who stop the moment they see you and fold it away.'),
    ],
    item: [
      e('df-it1', 'A horn on a strap, hanging from a branch. Blowing it seems like a very good and a very bad idea.'),
      e('df-it2', 'A bundle of arrows, fletched with feathers from a bird that does not live in this wood.'),
      e('df-it3', 'A cloak of leaves, sewn by hand, that makes whoever wears it hard to notice.'),
      e('df-it4', 'A jar of honey, sealed with wax, humming faintly.'),
      e('df-it5', 'A bone flute wedged in the fork of a tree, above head height.'),
      e('df-it6', 'A hunter’s pack with a week of food and a diary that ends mid-sentence three days ago.'),
    ],
    monster: [
      e('df-mo1', 'A branch snaps somewhere behind you. Then nothing, for a long time.'),
      e('df-mo2', 'The birds stop, all at once, and do not start again.'),
      e('df-mo3', 'Claw marks in the bark, higher than a bear reaches. Sap still running from them.'),
    ],
    'dead-end': [
      e('df-de1', 'The trail ends at a wall of thorn that closes behind you as you look at it.'),
      e('df-de2', 'A clearing with no way out but the way in, and a ring of mushrooms around its edge.'),
    ],
    trap: [
      e('df-tr1', 'A snare loop hidden under leaves, sized for something bigger than a deer.'),
      e('df-tr2', 'A deadfall trap: one log, one cord, and the cord is already parting.'),
    ],
  },
};
