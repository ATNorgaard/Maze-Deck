import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';

/** Sewer junctions and forgotten cellars. Everyone down here is going somewhere too. */
export const UNDERCITY: Biome = {
  id: 'undercity',
  name: 'Undercity',
  flavour: 'Sewer junctions and forgotten cellars. Everyone down here is going somewhere too.',
  motif: 'brick',
  cards: {
    'clear-path': {
      title: 'Culvert',
      rule: `The tunnel goes on. Score 1 point; ${ESCAPE_TARGET} and the party surfaces.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Grate',
      rule: 'Holds the tunnel until somebody spends an action on it.',
      emphasis: 'Holds the tunnel',
    },
    wanderer: {
      title: 'Dweller',
      rule: 'Friend or foe is the party’s read. Most down here only want to be left alone.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Scrap',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Lurker',
      rule: `One strike. At ${ENCOUNTER_AT} it has found the party in the dark.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Collapse',
      rule: 'No check clears it. Only a rallied party turns back. Blocks the tunnel.',
      emphasis: 'No check clears it.',
    },
    trap: {
      title: 'Gas Pocket',
      rule: `Check DC ${MAZE_DC} ± 1 at once. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('uc-cp1', 'A junction with a fresh chalk arrow on the wall. Somebody is keeping this route open.'),
      e('uc-cp2', 'The water level drops and the tunnel floor turns to old brick. This was a street once.'),
      e('uc-cp3', 'Daylight, through a grating high above, and the sound of a market.'),
      e('uc-cp4', 'A rope ladder, recently tied, going up a shaft that smells of bread.'),
      e('uc-cp5', 'A cellar door with the bolt on your side.'),
      e('uc-cp6', 'Rats, running the same way you are. They know something.'),
    ],
    obstacle: [
      e('uc-ob1', 'An iron grate, rusted shut, with the whole tunnel behind it.', 'STR', 0),
      e('uc-ob2', 'A crawl through a pipe with a fan turning at the far end.', 'DEX', 0),
      e('uc-ob3', 'A sluice with a lever-and-counterweight lock the old engineers were proud of.', 'INT', 1),
      e('uc-ob4', 'A stretch flooded to the chin, with the air above it not much better than the water.', 'CON', 0),
      e('uc-ob5', 'A junction of six identical tunnels, and the chalk arrows point down four of them.', 'WIS', 1),
      e('uc-ob6', 'A checkpoint run by the people who live down here, and they charge for passage.', 'CHA', 0),
    ],
    wanderer: [
      e('uc-wa1', 'A mudlark with a lantern and a sack, who knows every tunnel and will sell one of them.'),
      e('uc-wa2', 'A priest of something that lives in the deep water, cheerful, on his way to feed it.'),
      e('uc-wa3', 'A runaway with a stolen key and a plan that needs one more person.'),
      e('uc-wa4', 'Something pale that has lived down here long enough to forget the sun, and has not forgotten how to talk.'),
      e('uc-wa5', 'A tax collector, lost, who would very much like to not have been down here at all.'),
      e('uc-wa6', 'Two thieves splitting a take by lamplight, who blow out the lamp the moment they see yours.'),
    ],
    item: [
      e('uc-it1', 'A lantern with a shutter, still warm.'),
      e('uc-it2', 'A ring of keys stamped with the city’s crest, one for every gate.'),
      e('uc-it3', 'A waxed map of the sewers with three tunnels marked “don’t”.'),
      e('uc-it4', 'A crate of good wine, city seal intact, that somebody was hiding down here for later.'),
      e('uc-it5', 'A pair of waders that come up past the chest.'),
      e('uc-it6', 'A watchman’s whistle. Blowing it down here would be heard up there.'),
    ],
    monster: [
      e('uc-mo1', 'Something big moving through the water in the next tunnel, against the flow.'),
      e('uc-mo2', 'The rats reverse direction, all at once, and run past you.'),
      e('uc-mo3', 'Scratches in the brick at waist height, and a smell like a wet dog the size of a horse.'),
    ],
    'dead-end': [
      e('uc-de1', 'The tunnel ends in a wall of newer brick, and behind the brick, faintly, music.'),
      e('uc-de2', 'A shaft going straight up, no rungs, and the grating at the top cemented shut.'),
    ],
    trap: [
      e('uc-tr1', 'A pocket of bad air. The lantern flame goes blue.'),
      e('uc-tr2', 'The floor here is not floor. It is a plank over a cistern, and the plank has had enough.'),
    ],
  },
};
