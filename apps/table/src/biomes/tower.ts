import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';

/** Stairwells and landings. Up is the only way through, and every floor was somebody's. */
export const TOWER: Biome = {
  id: 'tower',
  name: 'Tower',
  flavour: 'Stairwells and landings. Up is the only way through, and every floor was somebody’s.',
  motif: 'stair',
  cards: {
    'clear-path': {
      title: 'Landing',
      rule: `The stair goes on. Score 1 point; ${ESCAPE_TARGET} and the party reaches the top.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Barred Stair',
      rule: 'Holds the stair until somebody spends an action on it.',
      emphasis: 'Holds the stair',
    },
    wanderer: {
      title: 'Occupant',
      rule: 'Friend or foe is the party’s read. Some climb with you, some keep their floor.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Relic',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Sentinel',
      rule: `One strike. At ${ENCOUNTER_AT} the tower knows you are in it.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Sealed Floor',
      rule: 'No check opens it. Only a rallied party turns back down. Blocks the stair.',
      emphasis: 'No check opens it.',
    },
    trap: {
      title: 'Loose Step',
      rule: `Check DC ${MAZE_DC} ± 1 at once. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('tw-cp1', 'A landing with a window. For the first time you can see how far up you are, and how far there is to go.'),
      e('tw-cp2', 'The stair widens and the steps are worn hollow in the middle. A lot of feet came this way, and recently.'),
      e('tw-cp3', 'A door on the landing stands open onto a room somebody left in a hurry. The stair continues past it.'),
      e('tw-cp4', 'The banister changes from rope to iron. Somebody higher up cared about falling.'),
      e('tw-cp5', 'Draught from above, cold and moving. The top is closer than the bottom now.'),
      e('tw-cp6', 'A bell rope hangs down the centre of the stairwell. Nobody has rung it. Yet.'),
    ],
    obstacle: [
      e('tw-ob1', 'A portcullis dropped across the landing, its chain rusted into the winch.', 'STR', 0),
      e('tw-ob2', 'The stair has fallen away. Eight feet of nothing between this step and the next one.', 'DEX', 0),
      e('tw-ob3', 'A door with a puzzle-lock: seven dials, one word, and the word is not in a language anyone here reads.', 'INT', 1),
      e('tw-ob4', 'Smoke pours down the stairwell from a floor above. Getting through means holding your breath for longer than is comfortable.', 'CON', 0),
      e('tw-ob5', 'Three identical stairs leave this landing and only one of them goes up. The other two go up as well, and then do not.', 'WIS', 1),
      e('tw-ob6', 'A guard at the door of the next floor, bored, armed, and under orders that do not quite cover you.', 'CHA', 0),
    ],
    wanderer: [
      e('tw-wa1', 'A scribe who lives on this floor and has not been downstairs in eleven years. They would like news, and will pay in directions.'),
      e('tw-wa2', 'Something in a robe that is the wrong shape underneath, climbing slowly, always one landing above you.'),
      e('tw-wa3', 'A boy with a tray, delivering supper to a floor that does not exist.'),
      e('tw-wa4', 'The tower’s old steward, still making rounds, still locking doors, mostly for people who died.'),
      e('tw-wa5', 'A prisoner, chain and all, who insists they were on their way down when you found them.'),
      e('tw-wa6', 'Two guards on a landing playing dice, who agree without discussion that they saw nobody.'),
    ],
    item: [
      e('tw-it1', 'A lantern hung on a nail, still lit, with a note under it reading “for whoever is next”.'),
      e('tw-it2', 'A ring of keys on a hook by the stair, each tagged with a floor number. One tag has been scratched off.'),
      e('tw-it3', 'A folded map of the tower, twenty floors of it, with the stair drawn in a different place on every sheet.'),
      e('tw-it4', 'A brass telescope on a landing, trained on a window in a tower across the valley where something waves.'),
      e('tw-it5', 'A pair of boots with the soles cut through. Whoever left them knew what the next stair was made of.'),
      e('tw-it6', 'A book left open on a step, the last line half-written: “the stair does not go where it”'),
    ],
    monster: [
      e('tw-mo1', 'Stone grinding on stone, above, and dust sifting down the well of the stair.'),
      e('tw-mo2', 'The bell rope twitches. Twice. Then it is pulled, hard, from the top.'),
      e('tw-mo3', 'Wingbeats in the stairwell, too slow for anything with feathers.'),
    ],
    'dead-end': [
      e('tw-de1', 'The stair ends at a floor bricked over from the other side. The mortar is fresher than the wall.'),
      e('tw-de2', 'A landing with no door, no stair, and one chair facing the wall.'),
    ],
    trap: [
      e('tw-tr1', 'The step gives, a hinge somewhere clicks, and the banister swings out over the drop.'),
      e('tw-tr2', 'A tripwire across the landing, strung to a bell. It is not the bell you should worry about.'),
    ],
  },
};
