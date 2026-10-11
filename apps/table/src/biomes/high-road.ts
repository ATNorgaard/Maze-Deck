import { ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC } from '@maze-deck/ui';
import { entry as e } from '../tables';
import type { Biome } from './types';
import backOutside from './art/back-high-road-outside.png';
import stillOutside from './art/world-high-road-outside.png';
import backInside from './art/back-high-road-inside.png';
import stillInside from './art/world-high-road-inside.png';

/** A summer storm on a pass cut into the cliff, and the caves under it. */
export const HIGH_ROAD: Biome = {
  id: 'high-road',
  name: 'High road',
  flavour: 'A summer storm on a pass cut into the cliff. A Clear Path is a gap in the cloud.',
  motif: 'crystal',
  light: 'wand',
  art: {
    outside: { back: backOutside, still: stillOutside },
    inside: { back: backInside, still: stillInside },
  },
  cards: {
    'clear-path': {
      title: 'Cloud Gap',
      rule: `The cloud breaks ahead. Score 1 point; ${ESCAPE_TARGET} and the party is over the pass.`,
      emphasis: '1 point',
    },
    obstacle: {
      title: 'Rockfall',
      rule: 'The fall holds the road until somebody spends an action on it.',
      emphasis: 'holds the road',
    },
    wanderer: {
      title: 'Goatherd',
      rule: 'Friend or foe is the party’s read. Some know the passes, some sell them.',
      emphasis: 'Friend or foe',
    },
    item: {
      title: 'Cairn Offering',
      rule: 'Take it or leave it. The card is discarded either way.',
      emphasis: 'discarded either way',
    },
    monster: {
      title: 'Ridge Giant',
      rule: `One strike. At ${ENCOUNTER_AT} the boulders start coming down on purpose.`,
      emphasis: 'One strike',
    },
    'dead-end': {
      title: 'Cut Bridge',
      rule: 'No check crosses it. Only a rallied party turns back. Blocks the gorge.',
      emphasis: 'No check crosses it.',
    },
    trap: {
      title: 'Loose Scree',
      rule: `Check DC ${MAZE_DC} ± 1 as the slope moves. Leaves the game either way.`,
      emphasis: `DC ${MAZE_DC} ± 1`,
    },
  },
  tables: {
    'clear-path': [
      e('hr-cp1', 'A gap in the cloud, and through it the road, cut into the cliff and running on.'),
      e('hr-cp2', 'A cairn with a prayer flag on a stick, snapping in the wind, where the path forks the right way.'),
      e('hr-cp3', 'A cave mouth out of the rain, with a dry floor and a way on at the back of it.'),
      e('hr-cp4', 'The rope bridge, old but sound, every plank there and the handrope taut.'),
      e('hr-cp5', 'Goat tracks, sure-footed, going round the shoulder of the mountain where the road could not.'),
      e('hr-cp6', 'The storm moves off down the valley, and the sun comes out on the pass.'),
    ],
    obstacle: [
      e('hr-ob1', 'A boulder the size of a cart in the middle of the road, fresh from above, and no way round it.', 'STR', 0),
      e('hr-ob2', 'A ledge a boot wide across the cliff, wet with spray from the falls.', 'DEX', 0),
      e('hr-ob3', 'A fallen bridge, and the timbers and rope to make another, if somebody knows how.', 'INT', 1),
      e('hr-ob4', 'The climb to the col, in rain like thrown gravel, with no shelter the whole way.', 'CON', 0),
      e('hr-ob5', 'Cloud on the pass, so thick the road and the drop look the same.', 'WIS', 1),
      e('hr-ob6', 'A watchtower on the col, and a captain who does not want anyone on his road in this weather.', 'CHA', 0),
    ],
    wanderer: [
      e('hr-wa1', 'A goatherd sheltering his flock in a cave mouth, who will share the fire, the cheese and the gossip of the passes.'),
      e('hr-wa2', 'A monk from the cliff monastery, coming down for salt, who walks the ledges like a road.'),
      e('hr-wa3', 'A surveyor for the king, measuring the pass for a road that will never be built.'),
      e('hr-wa4', 'A climber coming down the face above you on a rope tied to nothing you can see, who waves.'),
      e('hr-wa5', 'A smuggler with a mule and a load under oilcloth, who would rather not have been seen.'),
      e('hr-wa6', 'An old woman sitting out the storm in the lee of a cairn, who asks where you are going and nods as if she knew.'),
    ],
    item: [
      e('hr-it1', 'An offering at a wayside shrine: a silver bell, and a note asking for safe passage.'),
      e('hr-it2', 'A climber’s pack wedged in a crack, with iron spikes, a hammer and good rope.'),
      e('hr-it3', 'A goatskin of mountain spirits, the kind that warms you from the inside for an hour.'),
      e('hr-it4', 'A quartz crystal from the cave wall that holds its glow a while after the light is gone.'),
      e('hr-it5', 'A pair of hand-forged crampons, hung on a peg by a shelter door.'),
      e('hr-it6', 'An eagle feather as long as your arm, which the goatherds say means luck.'),
    ],
    monster: [
      e('hr-mo1', 'A shadow crosses the road: too big for a cloud, and too fast for one.'),
      e('hr-mo2', 'Rocks coming down the slope in the lightning, and between the flashes, something throwing them.'),
      e('hr-mo3', 'Footprints in the mud of the road, each one as long as you are tall.'),
    ],
    'dead-end': [
      e('hr-de1', 'The rope bridge, cut at this end, hanging down the far wall of the gorge.'),
      e('hr-de2', 'The road ends at a landslide that has taken the mountainside with it.'),
    ],
    trap: [
      e('hr-tr1', 'The scree starts moving, all of it, with you on it.'),
      e('hr-tr2', 'Lightning on the ridge above, and a second strike, nearer.'),
    ],
  },
};
