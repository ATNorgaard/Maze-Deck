import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backOutside from './art/back-drowned-coast-outside.png';
import stillOutside from './art/world-drowned-coast-outside.png';
import backInside from './art/back-drowned-coast-inside.png';
import stillInside from './art/world-drowned-coast-inside.png';

/** A wrecking coast in a storm, and the caves the wreckers use. */
export const DROWNED_COAST: Biome = {
  id: 'drowned-coast',
  name: 'Drowned coast',
  flavour: 'A wrecking coast in a storm, and the caves the wreckers use. A Clear Path is the lighthouse beam finding the way.',
  motif: 'dune',
  light: 'path',
  // The storm sea the lighthouse shines over.
  weather: 'wand',
  art: {
    outside: { back: backOutside, still: stillOutside },
    inside: { back: backInside, still: stillInside },
  },
  cards: {
    'clear-path': {
      title: 'Guiding Beam',
      rule: `The light finds the way. Score 1 point; ${ESCAPE_TARGET} and the party is off the rocks.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Flood Tide',
      rule: 'The tide holds the way until somebody spends an action on it.',
      emphasis: 'holds the way',
    },
    wanderer: {
      title: 'Beachcomber',
      rule: 'Friend or foe is the party’s read. Some pull you from the water, some go through your pockets.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Flotsam',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Drowned Bell',
      rule: `One strike. At ${ENCOUNTER_AT} the bell on the buoy rings by itself.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Sheer Cliff',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the way.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Undertow',
      rule: `Check DC ${MAZE_DC} ± 1 as the wave pulls back. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('dc-cp1', 'The lighthouse beam sweeps round and, for a moment, shows a path along the foot of the cliffs.'),
      e('dc-cp2', 'Steps cut in the rock, worn by a hundred years of wreckers, going up out of the spray.'),
      e('dc-cp3', 'The tide drops back off the causeway, and the stones are dry for as long as it takes to cross.'),
      e('dc-cp4', 'A lantern in a cave mouth, a jetty inside, and a boat on it with the oars still in.'),
      e('dc-cp5', 'Gulls on the rocks, all facing the same way, out of the wind. There is a lee over there.'),
      e('dc-cp6', 'A rope ladder down the cliff, tied off at the top by someone who meant to come back.'),
    ],
    obstacle: [
      e('dc-ob1', 'A cave mouth stopped with barrels the smugglers left, lashed together and too heavy for one.', 'STR', 0),
      e('dc-ob2', 'Wet rocks across the cove, slick with weed, and the waves breaking white between them.', 'DEX', 0),
      e('dc-ob3', 'A sea gate in the cave with a counterweight and a chain, and a smuggler’s mark that tells how it opens.', 'INT', 1),
      e('dc-ob4', 'Swimming the channel, in the dark, in water that takes your breath on the first stroke.', 'CON', 0),
      e('dc-ob5', 'Three lights on the shore in the rain, and two of them are wreckers’ lanterns.', 'WIS', 1),
      e('dc-ob6', 'Wreckers at the cave mouth with cudgels and lanterns, deciding whether you are salvage.', 'CHA', 0),
    ],
    wanderer: [
      e('dc-wa1', 'A beachcomber with a sack and a long hook, who knows what the sea gives up, and when.'),
      e('dc-wa2', 'The lighthouse keeper, out on the rocks in an oilskin, looking for the crew of the wreck.'),
      e('dc-wa3', 'A half-drowned sailor from the wreck, who will not say what the ship was carrying.'),
      e('dc-wa4', 'A smugglers’ lookout with a shuttered lantern and a whistle, who has not made up her mind about you.'),
      e('dc-wa5', 'A girl gathering wrack in a basket, singing a song about a bell under the water.'),
      e('dc-wa6', 'Someone sitting on the rocks with their back to you and their hair to their waist, combing it.'),
    ],
    item: [
      e('dc-it1', 'A sea chest washed up on the shingle, its lock rusted through and its contents dry.'),
      e('dc-it2', 'A ship’s lantern, brass and glass, that the storm has not put out.'),
      e('dc-it3', 'A grapnel on a length of anchor chain, and a good deal that can be done with both.'),
      e('dc-it4', 'A bottle with a letter in it, and a map on the back of the letter.'),
      e('dc-it5', 'The wreck’s figurehead, a woman in carved robes, with a key on a ribbon round her neck.'),
      e('dc-it6', 'A cask of brandy the smugglers missed, tucked behind a rock above the tide line.'),
    ],
    monster: [
      e('dc-mo1', 'Lights out on the water where no boat is, coming in with the tide.'),
      e('dc-mo2', 'The bell on the buoy, ringing in a rhythm the waves do not have.'),
      e('dc-mo3', 'Wet footprints on the jetty, coming up out of the water, and none going back.'),
    ],
    'dead-end': [
      e('dc-de1', 'The cove is closed: sheer cliff on three sides, and the sea coming in on the fourth.'),
      e('dc-de2', 'The cave goes back and back, and ends at a pool that goes down, black, past any light.'),
    ],
    trap: [
      e('dc-tr1', 'A wave bigger than the others, out of nowhere, and the undertow behind it.'),
      e('dc-tr2', 'Rotten planks on the jetty, and black water under them, deep.'),
    ],
  },
};
